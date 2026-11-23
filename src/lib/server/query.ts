import { GOLD_TABLES } from './gold-tables';
import { FIELD_TYPES } from './row-models';
import { qualifiedTable, quoteIdentifier } from './config';

export type Scalar = string | number | boolean | Date | null;
export type Comparison<T> = { equals?: T | null; gte?: T; lte?: T; gt?: T; lt?: T; in?: T[]; normalizedIn?: string[]; not?: T | null };
export type Where<T> = { [K in keyof T]?: T[K] | Comparison<NonNullable<T[K]>> } & { OR?: Where<T>[]; AND?: Where<T>[] };
export type Selection<T> = Partial<Record<keyof T, boolean>>;
export interface ReadOptions<T> {
  where?: Where<T>;
  select?: Selection<T>;
  distinct?: (keyof T)[];
  orderBy?: Partial<Record<keyof T, 'asc' | 'desc'>> | Partial<Record<keyof T, 'asc' | 'desc'>>[];
  take?: number;
}
export interface Statement { sql: string; parameters: Record<string, string | number | boolean> }

export function definition(table: string) {
  if (!Object.hasOwn(GOLD_TABLES, table)) throw new Error(`Unknown gold table: ${table}`);
  return GOLD_TABLES[table];
}

export function fieldSql(table: string, field: string): string {
  const column = Object.entries(definition(table).fields).find(([, camel]) => camel === field)?.[0];
  if (!column) throw new Error(`Unknown column ${field} on ${table}`);
  return quoteIdentifier(column);
}

export function compileWhere(table: string, where: object = {}): Statement {
  const parameters: Statement['parameters'] = {};
  const bind = (value: unknown) => {
    const key = `p${Object.keys(parameters).length}`;
    if (value instanceof Date) {
      if (!Number.isFinite(value.getTime())) throw new Error('Invalid query date.');
      parameters[key] = value.toISOString();
    } else if (typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      parameters[key] = value;
    } else throw new Error('Unsupported SQL parameter.');
    return ':' + key;
  };
  const walk = (input: object): string => {
    const parts: string[] = [];
    for (const [field, value] of Object.entries(input)) {
      if (value === undefined) continue;
      if (field === 'OR' || field === 'AND') {
        if (!Array.isArray(value)) throw new Error(`Invalid ${field} filter`);
        parts.push(value.length ? '(' + value.map(v => '(' + walk(v) + ')').join(` ${field} `) + ')' : field === 'OR' ? 'FALSE' : 'TRUE');
        continue;
      }
      const column = fieldSql(table, field);
      const isDate = FIELD_TYPES[definition(table).model][field] === 'DateTime';
      const param = (v: unknown) => isDate ? `CAST(${bind(v)} AS TIMESTAMP)` : bind(v);
      if (value === null) parts.push(`${column} IS NULL`);
      else if (value instanceof Date || typeof value !== 'object') parts.push(`${column} = ${param(value)}`);
      else for (const [operator, operand] of Object.entries(value)) {
        if (operand === undefined) continue;
        if (operator === 'normalizedIn') {
          if (FIELD_TYPES[definition(table).model][field] !== 'String' || !Array.isArray(operand) || operand.some(v => typeof v !== 'string')) throw new Error('Invalid normalized string filter');
          parts.push(operand.length ? `LOWER(TRIM(${column})) IN (${operand.map(v => bind(v.trim().toLowerCase())).join(', ')})` : 'FALSE');
        } else if (operator === 'in') {
          if (!Array.isArray(operand)) throw new Error('Invalid IN filter');
          parts.push(operand.length ? `${column} IN (${operand.map(param).join(', ')})` : 'FALSE');
        } else {
          const op = { equals: '=', not: '<>', gte: '>=', lte: '<=', gt: '>', lt: '<' }[operator];
          if (!op) throw new Error(`Unsupported filter operator: ${operator}`);
          parts.push(operand === null ? `${column} IS ${operator === 'not' ? 'NOT ' : ''}NULL` : `${column} ${op} ${param(operand)}`);
        }
      }
    }
    return parts.join(' AND ') || 'TRUE';
  };
  return { sql: walk(where), parameters };
}

export function compileRead<T>(table: string, options: ReadOptions<T> = {}): Statement {
  const def = definition(table);
  const fields = options.select ? Object.entries(options.select).filter(([, enabled]) => enabled).map(([key]) => key) : Object.values(def.fields);
  if (!fields.length) throw new Error('Select at least one column.');
  // SQL DISTINCT is equivalent to the current app's distinct requests, which select precisely the distinct keys.
  if (options.distinct && (options.distinct.length !== fields.length || options.distinct.some(f => !fields.includes(String(f))))) {
    throw new Error('Distinct keys must match selected columns.');
  }
  const filter = compileWhere(table, options.where);
  const order = options.orderBy ? (Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy]).flatMap(o => Object.entries(o).map(([key, dir]) => {
    if (dir !== 'asc' && dir !== 'desc') throw new Error('Invalid sort direction.');
    return `${fieldSql(table, key)} ${dir.toUpperCase()}`;
  })) : [];
  const limit = options.take;
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1)) throw new Error('Invalid row limit.');
  return {
    sql: `SELECT ${options.distinct ? 'DISTINCT ' : ''}${fields.map(f => `${fieldSql(table, f)} AS ${quoteIdentifier(f)}`).join(', ')} FROM ${qualifiedTable(table)} WHERE ${filter.sql}${order.length ? ' ORDER BY ' + order.join(', ') : ''}${limit ? ' LIMIT ' + limit : ''}`,
    parameters: filter.parameters,
  };
}

export function normalizeValue(kind: string | undefined, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (kind === 'DateTime') {
    // Arrow DATE values may be epoch milliseconds; Thrift dates are strings.
    const date = value instanceof Date ? value : typeof value === 'number' ? new Date(value) : new Date(String(value).replace(' ', 'T') + (/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(String(value).replace(' ', 'T')) ? 'Z' : ''));
    if (!Number.isFinite(date.getTime())) throw new Error('Warehouse returned an invalid date.');
    return date;
  }
  if (kind === 'Int' || kind === 'Float') {
    const number = Number(value);
    if (!Number.isFinite(number) || (kind === 'Int' && !Number.isSafeInteger(number))) throw new Error('Warehouse returned a number outside the supported range.');
    return number;
  }
  if (kind === 'Boolean') {
    if (value === true || value === 1 || value === 'true') return true;
    if (value === false || value === 0 || value === 'false') return false;
    throw new Error('Warehouse returned an invalid boolean.');
  }
  return String(value);
}
