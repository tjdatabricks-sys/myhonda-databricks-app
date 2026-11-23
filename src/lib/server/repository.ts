import { GOLD_TABLES } from './gold-tables';
import { FIELD_TYPES, type RowModels } from './row-models';
import { compileRead, compileWhere, fieldSql, normalizeValue, type ReadOptions, type Selection, type Statement, type Where } from './query';
import { positiveInteger, qualifiedTable, quoteIdentifier } from './config';

export type Execute = (statement: Statement) => Promise<Record<string, unknown>[]>;
type SummaryOptions<T> = { where?: Where<T>; _min?: Selection<T>; _max?: Selection<T>; _sum?: Selection<T> };
type Summary<T> = { _min: Partial<T>; _max: Partial<T>; _sum: Partial<Record<keyof T, number | null>> };

export class Repository<T extends object> {
  private countCache?: { at: number; promise: Promise<number> };
  constructor(public readonly table: string, private readonly execute: Execute) {}
  private normalize(row: Record<string, unknown>): T {
    const kinds = FIELD_TYPES[GOLD_TABLES[this.table].model];
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeValue(kinds[key], value)])) as T;
  }
  async selectRows(options: ReadOptions<T> = {}): Promise<T[]> {
    const cap = positiveInteger('DATABRICKS_MAX_ROWS', 100000, 1000000);
    const rows = await this.execute(compileRead(this.table, { ...options, take: options.take ?? cap + 1 }));
    if (rows.length > cap) throw new Error('Row limit exceeded. Narrow the selected filters.');
    return rows.map(row => this.normalize(row));
  }
  async findOne(options: ReadOptions<T>): Promise<T | null> {
    return (await this.selectRows({ ...options, take: 1 }))[0] ?? null;
  }
  async countRows(): Promise<number> {
    if (this.countCache && Date.now() - this.countCache.at < 60000) return this.countCache.promise;
    const promise = this.execute({ sql: `SELECT COUNT(*) AS total FROM ${qualifiedTable(this.table)}`, parameters: {} }).then(rows => normalizeValue('Int', rows[0]?.total) as number);
    this.countCache = { at: Date.now(), promise };
    try { return await promise; } catch (error) { this.countCache = undefined; throw error; }
  }
  async groupedSum<K extends keyof T>(keys: K[], measures: (keyof T)[]): Promise<T[]> {
    const fields = [...keys.map(key => `${fieldSql(this.table, String(key))} AS ${quoteIdentifier(String(key))}`), ...measures.map(key => `SUM(${fieldSql(this.table, String(key))}) AS ${quoteIdentifier(String(key))}`)];
    const rows = await this.execute({ sql: `SELECT ${fields.join(', ')} FROM ${qualifiedTable(this.table)} GROUP BY ${keys.map(key => fieldSql(this.table, String(key))).join(', ')}`, parameters: {} });
    return rows.map(row => this.normalize(row));
  }
  async summarize(options: SummaryOptions<T>): Promise<Summary<T>> {
    const fields: string[] = [];
    const filter = compileWhere(this.table, options.where);
    for (const aggregate of ['_min', '_max', '_sum'] as const) {
      for (const [field, enabled] of Object.entries(options[aggregate] ?? {})) {
        if (enabled) fields.push(`${aggregate.slice(1).toUpperCase()}(${fieldSql(this.table, field)}) AS ${quoteIdentifier(aggregate + '_' + field)}`);
      }
    }
    if (!fields.length) throw new Error('Select at least one aggregate.');
    const rows = await this.execute({ sql: `SELECT ${fields.join(', ')} FROM ${qualifiedTable(this.table)} WHERE ${filter.sql}`, parameters: filter.parameters });
    const result: Summary<T> = { _min: {}, _max: {}, _sum: {} };
    for (const aggregate of ['_min', '_max', '_sum'] as const) {
      for (const [field, enabled] of Object.entries(options[aggregate] ?? {})) {
        if (enabled) (result[aggregate] as Record<string, unknown>)[field] = normalizeValue(aggregate === '_sum' ? 'Float' : FIELD_TYPES[GOLD_TABLES[this.table].model][field], rows[0]?.[aggregate + '_' + field]);
      }
    }
    return result;
  }
  /** Stable ordering and paging bound memory without truncating CSV exports. */
  async *pages(): AsyncGenerator<T[]> {
    const fields = Object.values(GOLD_TABLES[this.table].fields);
    const size = Math.min(5000, positiveInteger('DATABRICKS_MAX_ROWS', 100000, 1000000));
    for (let offset = 0; ; offset += size) {
      const statement = compileRead(this.table, { take: size, orderBy: fields.map(field => ({ [field]: 'asc' })) } as ReadOptions<T>);
      statement.sql += ` OFFSET ${offset}`;
      const rows = await this.execute(statement);
      if (rows.length) yield rows.map(row => this.normalize(row));
      if (rows.length < size) break;
    }
  }
}

type Repositories = { [K in keyof RowModels as Uncapitalize<K>]: Repository<RowModels[K]> };
export function createRepositories(execute: Execute): Repositories {
  return Object.fromEntries(Object.entries(GOLD_TABLES).map(([table, def]) => [def.model.charAt(0).toLowerCase() + def.model.slice(1), new Repository(table, execute)])) as Repositories;
}
