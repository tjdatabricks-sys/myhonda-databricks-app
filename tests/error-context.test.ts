import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { recordFailure, failureDetails } from '../src/lib/server/error-context';
import { withApiErrors } from '../src/lib/server/api-errors';
import { createSqlExecutor } from '../src/lib/server/warehouse';
import type IDBSQLClient from '@databricks/sql/dist/contracts/IDBSQLClient';

test('runtime diagnostics expose the failure stage and redact credentials, SQL and parameters', async () => {
  process.env.DATABRICKS_CLIENT_SECRET = 'secret-value-for-test';
  const error = new TypeError('Cannot read properties of undefined; secret-value-for-test customer-value SELECT private_data');
  recordFailure(error, 'fetch_results', { p0: 'customer-value' });
  assert.equal(failureDetails(error).stage, 'fetch_results');
  const log = mock.method(console, 'error', () => {});
  try {
    const response = await withApiErrors(async () => { throw error; })(new Request('http://localhost/api/ready'));
    const body = await response.json();
    assert.equal(body.code, 'WAREHOUSE_RUNTIME');
    assert.equal(body.diagnosticsVersion, 3);
    assert.equal(body.stage, 'fetch_results');
    assert.match(body.runtimeMessage, /Cannot read properties/);
    assert.equal(body.stackFrames, undefined);
    assert.doesNotMatch(JSON.stringify(body) + JSON.stringify(log.mock.calls), /secret-value-for-test|customer-value|private_data/);
  } finally { log.mock.restore(); }
});

test('connection TypeErrors retain their stage and survive failing cleanup', async () => {
  process.env.DATABRICKS_HOST = 'https://test.cloud.databricks.com';
  process.env.DATABRICKS_WAREHOUSE_ID = 'test123';
  process.env.DATABRICKS_CLIENT_ID = 'test-client';
  const error = new TypeError('Original connection failure');
  const executor = createSqlExecutor(() => ({ async connect() { throw error; }, async close() { throw new Error('Cleanup failure'); } } as unknown as IDBSQLClient));
  await assert.rejects(executor.execute({ sql: 'SELECT 1', parameters: {} }), caught => caught === error);
  assert.equal(failureDetails(error).stage, 'connect');
});
