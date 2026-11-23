import { DBSQLClient } from '@databricks/sql';
import type IDBSQLClient from '@databricks/sql/dist/contracts/IDBSQLClient';
import type IDBSQLSession from '@databricks/sql/dist/contracts/IDBSQLSession';
import type IOperation from '@databricks/sql/dist/contracts/IOperation';
import { connectionSettings, positiveInteger, required } from './config';
import type { Statement } from './query';
import { recordFailure } from './error-context';

export class WarehouseError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 503) { super(message); }
}

/** One reusable OAuth connection, isolated sessions, and a bounded query queue. */
export function createSqlExecutor(makeClient: () => IDBSQLClient = () => new DBSQLClient({ logger: { log() {} } })) {
  let connection: Promise<IDBSQLClient> | undefined;
  let active = 0;
  const queue: (() => void)[] = [];
  async function acquire() {
    const concurrency = positiveInteger('DATABRICKS_QUERY_CONCURRENCY', 4, 16);
    if (active < concurrency) { active++; return; }
    if (queue.length >= 100) throw new WarehouseError('The warehouse is busy. Try again shortly.', 'WAREHOUSE_BUSY');
    await new Promise<void>(resolve => queue.push(resolve));
  }
  function release() {
    const next = queue.shift();
    if (next) next(); else active--;
  }
  function connect() {
    if (!connection) {
      const client = makeClient();
      const settings = { ...connectionSettings(), preserveBigNumericPrecision: true, socketTimeout: positiveInteger('DATABRICKS_QUERY_TIMEOUT_SECONDS', 120, 600) * 1000 };
      const token = process.env.DATABRICKS_TOKEN;
      const options = token && !process.env.DATABRICKS_APP_NAME
        ? { ...settings, token }
        : { ...settings, authType: 'databricks-oauth' as const, useDatabricksOAuthInAzure: true, oauthClientId: required('DATABRICKS_CLIENT_ID'), oauthClientSecret: required('DATABRICKS_CLIENT_SECRET') };
      connection = client.connect(options).catch(async error => {
        connection = undefined;
        try { await client.close(); } catch {}
        throw error;
      });
    }
    return connection!;
  }
  return {
    async execute(statement: Statement): Promise<Record<string, unknown>[]> {
      await acquire();
      let session: IDBSQLSession | undefined;
      let operation: IOperation | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;
      let stage = 'configuration';
      try {
        const cap = positiveInteger('DATABRICKS_MAX_ROWS', 100000, 1000000);
        const timeoutMs = positiveInteger('DATABRICKS_QUERY_TIMEOUT_SECONDS', 120, 600) * 1000;
        const work = (async () => {
          stage = 'connect';
          const client = await connect();
          if (timedOut) return [];
          stage = 'open_session';
          session = await client.openSession();
          if (timedOut) { await session.close(); return []; }
          stage = 'execute_statement';
          operation = await session.executeStatement(statement.sql, { namedParameters: statement.parameters, runAsync: true, maxRows: 1000, useLZ4Compression: false });
          if (timedOut) { await operation.cancel(); await operation.close(); await session.close(); return []; }
          const rows: Record<string, unknown>[] = [];
          do {
            stage = 'fetch_results';
            const chunk = await operation.fetchChunk({ maxRows: Math.min(5000, cap + 1 - rows.length) });
            rows.push(...chunk as Record<string, unknown>[]);
            if (rows.length > cap) throw new WarehouseError(`This request exceeds the ${cap.toLocaleString()} row limit. Narrow the filters or use the paginated CSV export.`, 'ROW_LIMIT', 422);
            stage = 'has_more_rows';
          } while (!timedOut && await operation.hasMoreRows());
          return rows;
        })();
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            void operation?.cancel().catch(() => {});
            reject(new WarehouseError('The warehouse query timed out. Check warehouse availability or narrow the filters.', 'QUERY_TIMEOUT', 504));
          }, timeoutMs);
        });
        return await Promise.race([work, timeout]);
      } catch (error) {
        recordFailure(error, stage, statement.parameters);
        throw error;
      } finally {
        if (timer) clearTimeout(timer);
        try { await operation?.close(); } catch {}
        try { await session?.close(); } catch {}
        release();
      }
    },
    async close() {
      const current = connection;
      connection = undefined;
      if (current) await (await current).close();
    },
  };
}

export const queryTransport = createSqlExecutor();
