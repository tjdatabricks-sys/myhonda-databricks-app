import { before, after, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixtureDatabase, csvRows, parseCsv } from './fixture';
import { queryTransport } from '../src/lib/server/warehouse';
import { GOLD_TABLES } from '../src/lib/server/gold-tables';
import type { OverviewResponse, FiltersResponse } from '../src/lib/api-types';

process.env.DATABRICKS_CATALOG = 'media-poc';
process.env.DATABRICKS_SCHEMA = 'gold_business';
const fixtures: Record<string, unknown> = {};
let close: () => void;

before(async () => {
  const fixture = await fixtureDatabase();
  mock.method(queryTransport, 'execute', fixture.execute);
  close = () => fixture.database.close();
});
after(() => {
  fs.mkdirSync('tests/generated', { recursive: true });
  fs.writeFileSync('tests/generated/api-responses.json', JSON.stringify(fixtures));
  mock.restoreAll(); close();
});

async function request(endpoint: string, query = '') {
  const { GET } = await import(`../src/app/api/${endpoint}/route.ts`);
  return GET(new Request(`http://localhost/api/${endpoint}${query}`));
}

test('all 15 analytics tabs and filters run against the complete 39-table fixture', async () => {
  for (const name of ['filters','overview','campaigns','paid-media','funnel','digital','experiments','omnichannel','customers','contribution','finance','targets','brand','ecom','schema','governance','health','ready']) {
    const response = await request(name);
    assert.equal(response.status, 200, `${name}: ${await response.clone().text()}`);
    const body = await response.json();
    assert.ok(body && Object.keys(body).length > 0, name);
    fixtures[name] = body;
  }
  const filters = fixtures.filters as FiltersResponse;
  fixtures.export = await (await request('export')).json();
  assert.equal(filters.totals.tables, 39);
  assert.equal(filters.totals.goldRows, 26854);
  const overview = fixtures.overview as OverviewResponse;
  const sum = (table: string, field: string) => csvRows(table).reduce((total, row) => total + Number(row[field]), 0);
  assert.equal(overview.kpis.spend, Math.round(sum('mart_demo_paid_media_daily', 'spend_usd') * 100) / 100);
  assert.equal(overview.kpis.fundedAccounts, sum('mart_demo_submission_funnel', 'submissions_with_funded_accounts'));
  assert.equal((fixtures.schema as {stats:{columns:number}}).stats.columns, 468);
});

test('filters preserve campaign attribution sentinels and daily/monthly boundaries', async () => {
  const campaign = csvRows('dim_campaign')[0].campaign_key;
  const response = await request('overview', `?campaign=${encodeURIComponent(campaign)}&from=2025-01-01&to=2025-06-30`);
  assert.equal(response.status, 200);
  const body = await response.json() as OverviewResponse;
  const paid = csvRows('mart_demo_paid_media_daily').filter(row => row.campaign_key === campaign && row.report_date.slice(0,10) >= '2025-01-01' && row.report_date.slice(0,10) <= '2025-06-30');
  const funnel = csvRows('mart_demo_submission_funnel').filter(row => [campaign,'UNATTRIBUTED'].includes(row.campaign_key) && row.submission_month.slice(0,10) >= '2025-01-01' && row.submission_month.slice(0,10) <= '2025-06-30');
  assert.equal(body.kpis.spend, Math.round(paid.reduce((n, row) => n + Number(row.spend_usd), 0) * 100) / 100);
  assert.equal(body.kpis.fundedAccounts, funnel.reduce((n, row) => n + Number(row.submissions_with_funded_accounts), 0));
  for (const endpoint of ['campaigns','paid-media','funnel','digital','omnichannel','customers','contribution','finance','targets','ecom']) {
    const filtered = await request(endpoint, `?campaign=${encodeURIComponent(campaign)}&market=MKT01&product=P01&segment=SEG01&platform=Google%20Ads&from=2025-01-01&to=2025-06-30`);
    assert.equal(filtered.status,200,endpoint);
    const empty = await request(endpoint,'?from=2099-01-01&to=2099-12-31');
    assert.equal(empty.status,200,`${endpoint} empty period`);
  }
});

test('all 39 CSV exports retain complete sample rows and schema column order', async () => {
  for (const [table, def] of Object.entries(GOLD_TABLES)) {
    const response = await request('export', '?table=' + table);
    assert.equal(response.status, 200, table);
    const [header, ...rows] = parseCsv(await response.text());
    assert.deepEqual(header, Object.keys(def.fields), table);
    assert.equal(rows.length, csvRows(table).length, table);
  }
  assert.equal((await request('export','?table=toString')).status,404);
  assert.equal((await request('export','?table=dim_campaign%3BDROP%20TABLE')).status,404);
});

test('warehouse failures return a useful error without exposing credentials or SQL', async () => {
  const original = queryTransport.execute;
  queryTransport.execute = async () => { throw new Error('SECRET_TOKEN SELECT customer_data'); };
  try {
    const response = await request('overview');
    assert.equal(response.status,503);
    const text = await response.text();
    assert.match(text,/permissions/);
    assert.doesNotMatch(text,/SECRET_TOKEN|SELECT customer_data/);
  } finally { queryTransport.execute = original; }
});
