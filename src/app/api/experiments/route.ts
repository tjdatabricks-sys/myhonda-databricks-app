import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/experiments — A/B test readouts with two-proportion
// z-tests (ExperimentsResponse contract; see src/lib/api-types.ts)
// Query params are intentionally ignored: each experiment is
// analyzed across its own window.
// Sources: mart_demo_experiment_variant joined to
// dim_web_experiment_variant (testKey + variantId) and dim_campaign.
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ExperimentsResponse, ExperimentVariantDto } from "@/lib/api-types";
import { parseFilters } from "@/lib/server/filters";
import { safeDiv, round4, groupBy, twoProportionZ } from "@/lib/server/helpers";

export const dynamic = "force-dynamic";

/** "Feb 15" (UTC, no timezone drift). */
const monthDayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
/** "Feb 15, 2024" (UTC, no timezone drift). */
const fullFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "Feb 15 – Mar 20, 2024" (begin year omitted when both dates share a year). */
function formatWindow(begin: Date, end: Date): string {
  const sameYear = begin.getUTCFullYear() === end.getUTCFullYear();
  const beginLabel = sameYear ? monthDayFmt.format(begin) : fullFmt.format(begin);
  return `${beginLabel} – ${fullFmt.format(end)}`;
}

async function handleGet(req: Request) {
  const f = await parseFilters(req); // filters intentionally ignored for experiments

  const [martRows, dimRows, campaigns] = await Promise.all([
    db.experimentVariantMart.selectRows({
      orderBy: [{ experimentId: "asc" }, { variantId: "asc" }],
    }),
    db.webExperimentVariant.selectRows(),
    db.campaign.selectRows({ select: { campaignKey: true, campaignTitle: true } }),
  ]);

  const campaignTitle = new Map(campaigns.map((c) => [c.campaignKey, c.campaignTitle]));
  // dim_web_experiment_variant lookups: per (testKey|variantId) and per testKey.
  const dimByVariant = new Map(dimRows.map((d) => [`${d.testKey}|${d.variantId}`, d]));
  const dimByTest = new Map<string, typeof dimRows>();
  for (const d of dimRows) {
    const list = dimByTest.get(d.testKey) ?? [];
    list.push(d);
    dimByTest.set(d.testKey, list);
  }
  const byExperiment = groupBy(martRows, (r) => r.experimentId);

  const experiments: ExperimentsResponse["experiments"] = [];

  for (const [experimentId, rows] of byExperiment) {
    const head = rows[0];
    const headDim =
      dimByVariant.get(`${experimentId}|${head.variantId}`) ??
      dimByTest.get(experimentId)?.[0];
    const campaignKey = head.campaignKey;

    const control = rows.find(
      (r) => dimByVariant.get(`${experimentId}|${r.variantId}`)?.variant === "Control"
    );
    const controlEligible = control?.eligibleUnits ?? 0;
    const controlConverted = control?.convertedUnits ?? 0;
    const controlRate = safeDiv(controlConverted, controlEligible);

    // Control first; stable sort keeps treatments in source order.
    const ordered = [...rows].sort((a, b) => {
      const ac =
        dimByVariant.get(`${experimentId}|${a.variantId}`)?.variant === "Control" ? 0 : 1;
      const bc =
        dimByVariant.get(`${experimentId}|${b.variantId}`)?.variant === "Control" ? 0 : 1;
      return ac - bc;
    });

    const variants: ExperimentVariantDto[] = ordered.map((r) => {
      const dim = dimByVariant.get(`${experimentId}|${r.variantId}`);
      const variantLabel = dim?.variant ?? r.variantId;
      const isControl = variantLabel === "Control";
      const rate = safeDiv(r.convertedUnits, r.eligibleUnits);
      const liftAbs = isControl ? 0 : rate - controlRate;
      const liftRel = isControl ? 0 : safeDiv(rate - controlRate, controlRate);
      const pValue = isControl
        ? 1
        : twoProportionZ(controlEligible, controlConverted, r.eligibleUnits, r.convertedUnits)
            .pValue;
      return {
        variantId: r.variantId,
        variant: variantLabel,
        allocationPct: Math.round(r.allocationFraction * 100),
        eligible: r.eligibleUnits,
        converted: r.convertedUnits,
        rate: round4(rate),
        liftAbs: round4(liftAbs),
        liftRel: round4(liftRel),
        significant: !isControl && pValue < 0.05,
        confidence: isControl ? 0 : round4(1 - pValue),
      };
    });

    const best = variants
      .filter((v) => v.variant !== "Control" && v.significant && v.liftRel > 0)
      .reduce<ExperimentVariantDto | null>(
        (acc, v) => (!acc || v.liftRel > acc.liftRel ? v : acc),
        null
      );

    experiments.push({
      experimentId,
      name: headDim?.experimentName ?? head.campaignName,
      hypothesis: headDim?.hypothesisText ?? "",
      primaryMetric: headDim?.primaryMetric ?? head.primaryEvent,
      status: headDim?.status ?? "Completed",
      ownerTeam: headDim?.ownerTeam ?? "Unknown",
      campaignKey,
      campaignTitle: head.campaignName || campaignTitle.get(campaignKey) || campaignKey,
      window: formatWindow(head.windowStart, head.windowEnd),
      variants,
      bestVariant: best ? best.variantId : null,
      bestLiftRel: best ? best.liftRel : 0,
    });
  }

  const winners = experiments.filter((e) => e.bestVariant !== null);
  const summary: ExperimentsResponse["summary"] = {
    total: experiments.length,
    completed: experiments.filter((e) => e.status === "Completed").length,
    running: experiments.filter((e) => e.status === "Running").length,
    winners: winners.length,
    avgLift: winners.length
      ? round4(winners.reduce((a, e) => a + e.bestLiftRel, 0) / winners.length)
      : 0,
  };

  const res: ExperimentsResponse = { experiments, summary };
  return NextResponse.json(res);
}

export const GET = withApiErrors(handleGet);
