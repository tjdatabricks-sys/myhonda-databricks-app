import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/export                  -> exportable gold_business tables + row counts
// GET /api/export?table=dim_campaign -> CSV attachment with that
//    table's rows (snake_case headers in registry column order).
// Registry: GOLD_TABLES (table -> { model, fields: snake->camel }).
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { GOLD_TABLES } from "@/lib/server/gold-tables";

export const dynamic = "force-dynamic";

type Delegate = {
  selectRows: () => Promise<Record<string, unknown>[]>;
  countRows: () => Promise<number>;
  pages: () => AsyncGenerator<Record<string, unknown>[]>;
};

/** Dates print as YYYY-MM-DD at UTC midnight, full ISO otherwise. */
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (v instanceof Date) {
    const midnight =
      v.getUTCHours() === 0 &&
      v.getUTCMinutes() === 0 &&
      v.getUTCSeconds() === 0 &&
      v.getUTCMilliseconds() === 0;
    s = midnight ? v.toISOString().slice(0, 10) : v.toISOString();
  } else if (typeof v === "boolean") {
    s = v ? "true" : "false";
  } else {
    s = String(v);
  }
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Warehouse repository for a PascalCase model name (e.g. "Branch" -> db.branch). */
function delegateFor(model: string): Delegate | null {
  return (db as unknown as Record<string, Delegate>)[
    model.charAt(0).toLowerCase() + model.slice(1)
  ] ?? null;
}

async function handleGet(req: Request) {
  const table = new URL(req.url).searchParams.get("table");

  if (!table) {
    const tables: { table: string; columns: number; rows: number }[] = [];
    for (const [t, def] of Object.entries(GOLD_TABLES).sort(([a], [b]) => a.localeCompare(b))) {
      const delegate = delegateFor(def.model);
      const rows = delegate ? await delegate.countRows() : 0;
      tables.push({ table: t, columns: Object.keys(def.fields).length, rows });
    }
    return NextResponse.json({
      tables,
      count: tables.length,
      totalRows: tables.reduce((acc, t) => acc + t.rows, 0),
    });
  }

  const def = Object.hasOwn(GOLD_TABLES, table) ? GOLD_TABLES[table] : undefined;
  if (!def) {
    return NextResponse.json(
      { error: `Unknown gold table "${table}"`, available: Object.keys(GOLD_TABLES).sort() },
      { status: 404 }
    );
  }
  const delegate = delegateFor(def.model);
  if (!delegate) {
    return NextResponse.json({ error: `No data model for table "${table}"` }, { status: 404 });
  }

  // Fetch the first page before sending headers, so initial failures remain JSON.
  const pages = delegate.pages();
  const first = await pages.next();
  const entries = Object.entries(def.fields);
  const encoder = new TextEncoder();
  let initial = true;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const page = initial ? first : await pages.next();
        const header = initial ? entries.map(([snake]) => snake).join(',') + '\n' : '';
        initial = false;
        const lines = page.done ? '' : page.value.map(row => entries.map(([, camel]) => csvEscape(row[camel])).join(',')).join('\n') + '\n';
        if (header || lines) controller.enqueue(encoder.encode(header + lines));
        if (page.done) controller.close();
      } catch {
        controller.error(new Error('CSV export interrupted. Retry when the warehouse is available.'));
        await pages.return(undefined);
      }
    },
    async cancel() { await pages.return(undefined); },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gold_${table}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export const GET = withApiErrors(handleGet);
