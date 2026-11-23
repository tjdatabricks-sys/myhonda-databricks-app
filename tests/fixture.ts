import fs from 'node:fs';
import initSqlJs, { type Database } from 'sql.js';
import schema from '../data/gold-business-schema.json';
import { GOLD_TABLES } from '../src/lib/server/gold-tables';
import type { Statement } from '../src/lib/server/query';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(field); field = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function csvRows(table: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(fs.readFileSync(`sample-data/data/${table}.csv`, 'utf8'));
  return rows.map(row => Object.fromEntries(header.map((name, i) => [name, row[i]])));
}

export async function fixtureDatabase() {
  const SQL = await initSqlJs();
  const database = new SQL.Database();
  for (const table of Object.keys(GOLD_TABLES)) {
    const columns = schema.filter(row => row.table_name === table);
    database.run(`CREATE TABLE \`${table}\` (${columns.map(col => `\`${col.column_name}\` ${['INT','BIGINT','DOUBLE','FLOAT','BOOLEAN','DECIMAL'].some(t => col.data_type.startsWith(t)) ? 'NUMERIC' : 'TEXT'}`).join(', ')})`);
    const insert = database.prepare(`INSERT INTO \`${table}\` VALUES (${columns.map(() => '?').join(',')})`);
    database.run('BEGIN');
    for (const row of csvRows(table)) insert.run(columns.map(col => {
      const value = row[col.column_name];
      if (value === '') return null;
      if (col.data_type === 'BOOLEAN') return value === 'true' ? 1 : 0;
      if (['DATE','TIMESTAMP'].includes(col.data_type)) return value.length === 10 ? value + 'T00:00:00.000Z' : value;
      return value;
    }));
    database.run('COMMIT'); insert.free();
  }
  return { database, execute: (statement: Statement) => executeFixture(database, statement) };
}

/** Only tests replace the wire transport. The production query compiler,
 * repositories, route handlers and response calculations execute unchanged.
 * SQLite supplies a local relational engine; this does not validate Spark's
 * server dialect, OAuth, networking, or Unity Catalog permission enforcement. */
export async function executeFixture(database: Database, statement: Statement): Promise<Record<string, unknown>[]> {
  if (statement.sql.includes('information_schema.columns')) return schema.map(row => ({ ...row, ordinal_position: Number(row.ordinal_position) }));
  const sql = statement.sql.replace(/`(?:``|[^`])+`\.`(?:``|[^`])+`\.`((?:``|[^`])+)`/g, '`$1`').replace(/CAST\((:p\d+) AS TIMESTAMP\)/g, '$1');
  const query = database.prepare(sql);
  const params = Object.fromEntries(Object.entries(statement.parameters).map(([key, value]) => [':' + key, typeof value === 'boolean' ? Number(value) : value]));
  try {
    query.bind(params);
    const rows: Record<string, unknown>[] = [];
    while (query.step()) rows.push(query.getAsObject());
    return rows;
  } finally { query.free(); }
}
