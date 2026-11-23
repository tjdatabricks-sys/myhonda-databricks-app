import { test } from 'node:test';
import assert from 'node:assert/strict';
import type IDBSQLClient from '@databricks/sql/dist/contracts/IDBSQLClient';
import { createSqlExecutor, WarehouseError } from '../src/lib/server/warehouse';

process.env.DATABRICKS_HOST = 'https://test.azuredatabricks.net';
process.env.DATABRICKS_WAREHOUSE_ID = 'warehouse1';
process.env.DATABRICKS_CLIENT_ID = 'test-client';
process.env.DATABRICKS_CLIENT_SECRET = 'test-secret';
process.env.DATABRICKS_APP_NAME = 'test-app';

function fakeClient(options: { delay?: number; rows?: object[]; connectFailure?: boolean } = {}) {
  const calls = { connect: 0, sessions: 0, active: 0, maxActive: 0, closed: 0, cancelled: 0, connectionOptions: {} as Record<string, unknown>, statementOptions: {} as Record<string, unknown> };
  const client = {
    async connect(connectionOptions: Record<string, unknown>) {
      calls.connect++; calls.connectionOptions = connectionOptions;
      if (options.connectFailure) throw new Error('connection failed');
      return client;
    },
    async openSession() {
      calls.sessions++; calls.active++; calls.maxActive = Math.max(calls.maxActive,calls.active);
      return {
        async executeStatement(_sql: string, statementOptions: Record<string, unknown>) {
          calls.statementOptions = statementOptions;
          return {
            async fetchChunk() {
              if (options.delay) await new Promise(resolve => setTimeout(resolve,options.delay));
              return options.rows ?? [{total:1}];
            },
            async hasMoreRows() { return false; },
            async cancel() { calls.cancelled++; },
            async close() {},
          };
        },
        async close() { calls.closed++; calls.active--; },
      };
    },
    async close() {},
  };
  return {client:client as unknown as IDBSQLClient,calls};
}
const statement = {sql:'SELECT :p0',parameters:{p0:'bound-value'}};

test('OAuth configuration supports Azure, binds values, reuses connections and bounds concurrency',async () => {
  process.env.DATABRICKS_QUERY_CONCURRENCY='1';
  const fake = fakeClient({delay:10});
  const executor = createSqlExecutor(() => fake.client);
  await Promise.all([executor.execute(statement),executor.execute(statement),executor.execute(statement)]);
  assert.equal(fake.calls.connect,1);
  assert.equal(fake.calls.maxActive,1);
  assert.equal(fake.calls.closed,3);
  assert.equal(fake.calls.connectionOptions.authType,'databricks-oauth');
  assert.equal(fake.calls.connectionOptions.useDatabricksOAuthInAzure,true);
  assert.equal(fake.calls.connectionOptions.preserveBigNumericPrecision,true);
  assert.deepEqual(fake.calls.statementOptions.namedParameters,statement.parameters);
  assert.equal(fake.calls.statementOptions.useLZ4Compression,false);
  await executor.close();
});

test('failed initial connections can be retried and release their queue slot',async () => {
  const failed=fakeClient({connectFailure:true}), working=fakeClient();
  let attempt=0;
  const executor=createSqlExecutor(() => (++attempt === 1 ? failed.client : working.client));
  await assert.rejects(executor.execute(statement),/connection failed/);
  assert.deepEqual(await executor.execute(statement),[{total:1}]);
  await executor.close();
});

test('a deadline cancels the operation and closes the isolated session',async () => {
  process.env.DATABRICKS_QUERY_TIMEOUT_SECONDS='1';
  const fake=fakeClient({delay:1100});
  const executor=createSqlExecutor(() => fake.client);
  await assert.rejects(executor.execute(statement),error => error instanceof WarehouseError && error.code === 'QUERY_TIMEOUT');
  assert.equal(fake.calls.cancelled,1);
  assert.equal(fake.calls.closed,1);
  delete process.env.DATABRICKS_QUERY_TIMEOUT_SECONDS;
  await executor.close();
});

test('row limits fail explicitly and clean up the session',async () => {
  process.env.DATABRICKS_MAX_ROWS='1';
  const fake=fakeClient({rows:[{total:1},{total:2}]});
  const executor=createSqlExecutor(() => fake.client);
  await assert.rejects(executor.execute(statement),error => error instanceof WarehouseError && error.code === 'ROW_LIMIT');
  assert.equal(fake.calls.closed,1);
  delete process.env.DATABRICKS_MAX_ROWS;
  await executor.close();
});
