import { GOLD_TABLES } from './gold-tables';
import { FIELD_TYPES } from './row-models';
import { namespace, qualifiedTable, quoteIdentifier } from './config';
import { queryTransport, WarehouseError } from './warehouse';

export interface LiveColumn { table_name: string; column_name: string; data_type: string; ordinal_position: number }
let cached: { at: number; promise: Promise<LiveColumn[]> } | undefined;

export function compatibleType(expected: string, actual: string): boolean {
  const type = actual.toUpperCase().split('(')[0];
  if (expected === 'String') return ['STRING', 'VARCHAR', 'CHAR'].includes(type);
  if (expected === 'DateTime') return ['DATE', 'TIMESTAMP', 'TIMESTAMP_NTZ'].includes(type);
  if (expected === 'Boolean') return type === 'BOOLEAN';
  if (expected === 'Int') return ['TINYINT', 'SMALLINT', 'INT', 'INTEGER', 'BIGINT', 'LONG', 'SHORT', 'BYTE'].includes(type);
  return ['FLOAT', 'DOUBLE', 'DECIMAL', 'NUMERIC', 'REAL', 'TINYINT', 'SMALLINT', 'INT', 'INTEGER', 'BIGINT', 'LONG'].includes(type);
}

export function validateColumns(columns: LiveColumn[]): string[] {
  const lookup = new Map(columns.map(c => [`${c.table_name}.${c.column_name}`.toLowerCase(), c]));
  const issues: string[] = [];
  for (const [table, def] of Object.entries(GOLD_TABLES)) {
    for (const [column, field] of Object.entries(def.fields)) {
      const actual = lookup.get(`${table}.${column}`.toLowerCase());
      if (!actual) issues.push(`Missing or inaccessible: ${table}.${column}`);
      else if (!compatibleType(FIELD_TYPES[def.model][field], actual.data_type)) issues.push(`Incompatible type: ${table}.${column} (${actual.data_type})`);
    }
  }
  return issues;
}

export async function liveColumns(): Promise<LiveColumn[]> {
  if (cached && Date.now() - cached.at < 60000) return cached.promise;
  const { catalog, schema } = namespace();
  const promise = queryTransport.execute({
    sql: `SELECT table_name, column_name, data_type, ordinal_position FROM ${quoteIdentifier(catalog)}.information_schema.columns WHERE table_catalog = :catalog AND table_schema = :schema ORDER BY table_name, ordinal_position`,
    parameters: { catalog, schema },
  }).then(rows => rows.map(row => ({ table_name: String(row.table_name).toLowerCase(), column_name: String(row.column_name).toLowerCase(), data_type: String(row.data_type), ordinal_position: Number(row.ordinal_position) })));
  cached = { at: Date.now(), promise };
  try { return await promise; } catch (error) { cached = undefined; throw error; }
}

let ready: { at: number; promise: Promise<void> } | undefined;
export async function assertReady(): Promise<void> {
  if (ready && Date.now() - ready.at < 60000) return ready.promise;
  const promise = (async () => {
    const issues = validateColumns(await liveColumns());
    if (issues.length) throw new WarehouseError(`Gold schema validation failed: ${issues.slice(0, 8).join('; ')}${issues.length > 8 ? `; ${issues.length - 8} more issues` : ''}. Check catalog/schema, required columns, and SELECT grants.`, 'SCHEMA_MISMATCH');
    // Metadata visibility alone does not prove SELECT access. Check every table.
    await Promise.all(Object.keys(GOLD_TABLES).map(table => queryTransport.execute({ sql: `SELECT * FROM ${qualifiedTable(table)} LIMIT 0`, parameters: {} })));
  })();
  ready = { at: Date.now(), promise };
  try { await promise; } catch (error) { ready = undefined; throw error; }
}
