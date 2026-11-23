import { NextResponse } from 'next/server';
import { ConfigurationError } from './config';
import { WarehouseError } from './warehouse';

export function warehouseDiagnostic(error: unknown): { message: string; code: string; status: number } {
  // Inspect driver details only for classification. Never return or log them:
  // driver messages can contain SQL text, values, URLs, or credentials.
  const detail = error instanceof Error ? error.message.toLowerCase() : '';
  if (/unauthorized|invalid_client|invalid client|invalid.*token|oauth|authentication|\b401\b/.test(detail)) {
    return { code: 'WAREHOUSE_AUTHENTICATION', status: 503, message: 'Databricks OAuth authentication failed. Verify the app service principal credentials are injected by Databricks Apps. Do not use local PAT credentials in the deployed app.' };
  }
  if (/permission|insufficient_privilege|access.denied|not.authorized|forbidden|\b403\b|42501/.test(detail)) {
    return { code: 'WAREHOUSE_PERMISSION', status: 503, message: 'The app service principal lacks access. Grant Can use on the bound SQL warehouse and USE CATALOG, USE SCHEMA, and SELECT on the required tables. The developer\'s own permissions do not grant access to the app.' };
  }
  if (/table_or_view_not_found|schema_not_found|catalog_not_found|unresolved_column|42p01|42703/.test(detail)) {
    return { code: 'WAREHOUSE_SCHEMA', status: 503, message: 'A required catalog, schema, table, or column was not found. Check DATABRICKS_CATALOG and DATABRICKS_SCHEMA against the supplied 39-table schema contract.' };
  }
  if (/enotfound|econnrefused|etimedout|econnreset|fetch failed|socket|network|certificate/.test(detail)) {
    return { code: 'WAREHOUSE_CONNECTION', status: 503, message: 'The app could not reach the SQL warehouse. Verify the warehouse is available and the app\'s networking permits access to its workspace endpoint.' };
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
