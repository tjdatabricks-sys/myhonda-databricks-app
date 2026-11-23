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
  const raw = required('DATABRICKS_HOST');
  let url: URL;
  try {
    // Workspace configuration can supply either a bare server hostname or an
    // HTTPS URL. The SQL driver always needs the bare hostname.
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    throw new ConfigurationError('DATABRICKS_HOST is invalid. Use the workspace hostname from the SQL warehouse Connection details, or its HTTPS workspace URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || !url.hostname.includes('.') || (url.port && url.port !== '443')) {
    throw new ConfigurationError('DATABRICKS_HOST must be a workspace hostname or HTTPS workspace URL, without a path, credentials, or a non-HTTPS port.');
  }
  if (url.hostname.endsWith('.databricksapps.com') || url.hostname === 'databricksapps.com') {
    throw new ConfigurationError('DATABRICKS_HOST points to an app URL. Use the Databricks workspace hostname from the SQL warehouse Connection details instead.');
  }
  const warehouseId = required('DATABRICKS_WAREHOUSE_ID');
  if (!/^[a-zA-Z0-9-]+$/.test(warehouseId)) throw new ConfigurationError('Invalid warehouse ID.');
  return { host: url.hostname, path: `/sql/1.0/warehouses/${warehouseId}` };
}
