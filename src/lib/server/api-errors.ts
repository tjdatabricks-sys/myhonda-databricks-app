import { NextResponse } from 'next/server';
import { ConfigurationError } from './config';
import { WarehouseError } from './warehouse';

function driverDetails(error: unknown): string {
  // The SQL driver's StatusError is a plain object, not an Error subclass.
  // Retry/operation errors can also carry the actual cause in nested fields.
  // These strings are used only to select a fixed diagnostic, never exposed.
  const seen = new Set<object>();
  function walk(value: unknown, depth: number): string[] {
    if (typeof value === 'string') return [value];
    if (!value || typeof value !== 'object' || depth > 4 || seen.has(value)) return [];
    seen.add(value);
    const record = value as Record<string, unknown>;
    return ['name', 'message', 'errorMessage', 'sqlState', 'cause', 'response', 'status', 'payload'].flatMap(key => walk(record[key], depth + 1));
  }
  return walk(error, 0).join(' ').toLowerCase();
}

export function warehouseDiagnostic(error: unknown): { message: string; code: string; status: number } {
  // Inspect driver details only for classification. Never return or log them:
  // driver messages can contain SQL text, values, URLs, or credentials.
  const detail = driverDetails(error);
  if (/unauthorized|invalid_client|invalid client|invalid.*token|oauth|authentication|\b401\b/.test(detail)) {
    return { code: 'WAREHOUSE_AUTHENTICATION', status: 503, message: 'Databricks OAuth authentication failed. Verify the app service principal credentials are injected by Databricks Apps. Do not use local PAT credentials in the deployed app.' };
  }
  if (/permission|insufficient_privilege|access.denied|not.authorized|forbidden|\b403\b|42501/.test(detail)) {
    return { code: 'WAREHOUSE_PERMISSION', status: 503, message: 'The app service principal lacks access. Grant Can use on the bound SQL warehouse and USE CATALOG, USE SCHEMA, and SELECT on the required tables. The developer\'s own permissions do not grant access to the app.' };
  }
  if (/table_or_view_not_found|schema_not_found|catalog_not_found|unresolved_column|42p01|42703/.test(detail)) {
    return { code: 'WAREHOUSE_SCHEMA', status: 503, message: 'A required catalog, schema, table, or column was not found. Check DATABRICKS_CATALOG and DATABRICKS_SCHEMA against the supplied 39-table schema contract.' };
  }
  if (/parse_syntax_error|syntax error|42601|datatype_mismatch|42k09/.test(detail)) {
    return { code: 'WAREHOUSE_QUERY', status: 503, message: 'Databricks rejected a SQL statement or a column type. Check the failed statement in SQL warehouse Query History for the app service principal. This is a SQL/schema compatibility issue; granting additional access may not resolve it.' };
  }
  if (/enotfound|econnrefused|etimedout|econnreset|fetch failed|socket|network|certificate/.test(detail)) {
    return { code: 'WAREHOUSE_CONNECTION', status: 503, message: 'The app could not reach the SQL warehouse. Verify the warehouse is available and the app\'s networking permits access to its workspace endpoint.' };
  }
  if (/max retry|retry timeout|timed out|timeout_exceeded/.test(detail)) {
    return { code: 'WAREHOUSE_RETRY_EXHAUSTED', status: 503, message: 'The SQL driver exhausted its connection or query retries. Check SQL warehouse availability and Query History, and verify the app can reach the workspace endpoint.' };
  }
  return { message: 'Unable to query the warehouse. Check warehouse availability, schema compatibility, and app service principal permissions.', code: 'WAREHOUSE_ERROR', status: 503 };
}

export function withApiErrors(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try { return await handler(request); }
    catch (error) {
      const id = crypto.randomUUID();
      let { message, code, status } = warehouseDiagnostic(error);
      if (error instanceof ConfigurationError) { message = error.message; code = 'CONFIGURATION_ERROR'; }
      if (error instanceof WarehouseError) { message = error.message; code = error.code; status = error.status; }
      console.error(JSON.stringify({ event: 'api_error', id, code, message, errorType: error instanceof Error ? error.name : 'Unknown' }));
      return NextResponse.json({ error: message, code, requestId: id }, { status, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}
