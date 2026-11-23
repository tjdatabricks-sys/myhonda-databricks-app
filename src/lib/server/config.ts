export class ConfigurationError extends Error {}

export function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('<')) throw new ConfigurationError(`Set ${name} in app.yaml.`);
  return value;
}

export function positiveInteger(name: string, fallback: number, max: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new ConfigurationError(`${name} must be an integer between 1 and ${max}.`);
  }
  return value;
}

export function quoteIdentifier(value: string): string {
  if (!value || /[\u0000-\u001f]/.test(value)) throw new ConfigurationError('Invalid SQL identifier.');
  return '`' + value.replace(/`/g, '``') + '`';
}

export function namespace() {
  return { catalog: required('DATABRICKS_CATALOG'), schema: required('DATABRICKS_SCHEMA') };
}

export function qualifiedTable(table: string): string {
  const { catalog, schema } = namespace();
  return [catalog, schema, table].map(quoteIdentifier).join('.');
}

export function connectionSettings() {
  const url = new URL(required('DATABRICKS_HOST'));
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/') {
    throw new ConfigurationError('DATABRICKS_HOST must be an HTTPS workspace URL.');
  }
  const warehouseId = required('DATABRICKS_WAREHOUSE_ID');
  if (!/^[a-zA-Z0-9-]+$/.test(warehouseId)) throw new ConfigurationError('Invalid warehouse ID.');
  return { host: url.host, path: `/sql/1.0/warehouses/${warehouseId}` };
}
