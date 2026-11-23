import { NextResponse } from 'next/server';
import { ConfigurationError } from './config';
import { WarehouseError } from './warehouse';

export function withApiErrors(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try { return await handler(request); }
    catch (error) {
      const id = crypto.randomUUID();
      let message = 'Unable to query the warehouse. Check warehouse availability, schema compatibility, and app service principal permissions.';
      let code = 'WAREHOUSE_ERROR';
      let status = 503;
      if (error instanceof ConfigurationError) { message = error.message; code = 'CONFIGURATION_ERROR'; }
      if (error instanceof WarehouseError) { message = error.message; code = error.code; status = error.status; }
      console.error(JSON.stringify({ event: 'api_error', id, code, errorType: error instanceof Error ? error.name : 'Unknown' }));
      return NextResponse.json({ error: message, code, requestId: id }, { status, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}
