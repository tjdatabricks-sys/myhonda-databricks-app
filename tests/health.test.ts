import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { GET as health } from '../src/app/api/health/route';
import { GET as ready } from '../src/app/api/ready/route';
import { queryTransport } from '../src/lib/server/warehouse';
import { warehouseDiagnostic } from '../src/lib/server/api-errors';

test('deployment health succeeds without warehouse settings or any SQL calls', async () => {
  const transport = mock.method(queryTransport, 'execute', async () => { throw new Error('Warehouse unavailable'); });
  try {
    const response = await health();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'alive');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(transport.mock.callCount(), 0);
  } finally { transport.mock.restore(); }
});

test('warehouse readiness remains unhealthy when SELECT permission is denied', async () => {
  process.env.DATABRICKS_CATALOG = 'media-poc';
  process.env.DATABRICKS_SCHEMA = 'gold_business';
  const transport = mock.method(queryTransport, 'execute', async () => { throw new Error('INSUFFICIENT_PRIVILEGES: SQL SELECT secret_customer_data SECRET_TOKEN'); });
  try {
    const response = await ready(new Request('http://localhost/api/ready'));
    assert.equal(response.status, 503);
    const body = await response.text();
    assert.match(body, /WAREHOUSE_PERMISSION/);
    assert.match(body, /app service principal/);
    assert.doesNotMatch(body, /secret_customer_data|SECRET_TOKEN/);
    assert.equal((await health()).status, 200);
  } finally { transport.mock.restore(); }
});

test('diagnostics distinguish authentication, permissions, schema and connection errors safely', () => {
  for (const [detail, code] of [['invalid_client SECRET_TOKEN','WAREHOUSE_AUTHENTICATION'], ['403 Forbidden SECRET_TOKEN','WAREHOUSE_PERMISSION'], ['TABLE_OR_VIEW_NOT_FOUND SECRET_TOKEN','WAREHOUSE_SCHEMA'], ['ENOTFOUND SECRET_TOKEN','WAREHOUSE_CONNECTION']] as const) {
    const diagnostic = warehouseDiagnostic(new Error(detail));
    assert.equal(diagnostic.code, code);
    assert.doesNotMatch(diagnostic.message, /SECRET_TOKEN/);
  }
});

test('SQL driver plain-object and nested errors keep their diagnosis without exposing details', async () => {
  const cases = [
    { error: { name: 'Status Error', message: 'INSUFFICIENT_PRIVILEGES SECRET_TOKEN', code: 7 }, code: 'WAREHOUSE_PERMISSION' },
    { error: { name: 'Status Error', message: 'TABLE_OR_VIEW_NOT_FOUND secret_customer_data' }, code: 'WAREHOUSE_SCHEMA' },
    { error: { message: 'The operation failed due to an error', response: { errorMessage: 'PARSE_SYNTAX_ERROR SELECT secret_customer_data', sqlState: '42601' } }, code: 'WAREHOUSE_QUERY' },
    { error: { message: 'Max retry count exceeded', payload: { cause: { message: 'ECONNRESET SECRET_TOKEN' } } }, code: 'WAREHOUSE_CONNECTION' },
    { error: { message: 'Max retry count exceeded' }, code: 'WAREHOUSE_RETRY_EXHAUSTED' },
  ];
  for (const { error, code } of cases) {
    const diagnostic = warehouseDiagnostic(error);
    assert.equal(diagnostic.code, code);
    assert.doesNotMatch(diagnostic.message, /SECRET_TOKEN|secret_customer_data/);
  }
  const { withApiErrors } = await import('../src/lib/server/api-errors');
  const handler = withApiErrors(async () => { throw cases[0].error; });
  const response = await handler(new Request('http://localhost/api/ready'));
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.match(body, /WAREHOUSE_PERMISSION/);
  assert.doesNotMatch(body, /SECRET_TOKEN/);
});
