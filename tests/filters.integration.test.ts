import { before, after, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixtureDatabase, csvRows } from './fixture';
import { queryTransport } from '../src/lib/server/warehouse';
import { GOLD_TABLES } from '../src/lib/server/gold-tables';
import { canonicalPlatform, platformAliases, platformOptions } from '../src/lib/platforms';
import { FILTER_CAPABILITIES, parametersForReport } from '../src/lib/filter-capabilities';
import { parseFilters, tableWhere } from '../src/lib/server/filters';
import { createRepositories } from '../src/lib/server/repository';
import { compileWhere } from '../src/lib/server/query';
import { useFilterStore } from '../src/lib/store';

process.env.DATABRICKS_CATALOG = 'media-poc';
process.env.DATABRICKS_SCHEMA = 'gold_business';
let fixture: Awaited<ReturnType<typeof fixtureDatabase>>;
const responses: Record<string, unknown> = {};
const date = (value: string) => value.slice(0,10);
const sum = (rows: Record<string,string>[], field: string) => rows.reduce((n,r) => n + Number(r[field]),0);
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const market = csvRows('dim_market')[0];
const segment = csvRows('dim_customer_segment')[0].segment_id;
const product = csvRows('dim_campaign')[0].product_id;
const endpoints = Object.keys(FILTER_CAPABILITIES);
const rawOptions = Object.entries(GOLD_TABLES).filter(([,def]) => def.fields.platform).flatMap(([table]) => csvRows(table).map(row => row.platform));

before(async () => {
  fixture = await fixtureDatabase();
  mock.method(queryTransport, 'execute', fixture.execute);
});
after(() => {
  fs.mkdirSync('tests/generated',{recursive:true});
  fs.writeFileSync('tests/generated/filter-responses.json',JSON.stringify(responses));
  mock.restoreAll(); fixture.database.close();
});
async function request(endpoint: string, params: Record<string,string> = {}) {
  const {GET} = await import(`../src/app/api/${endpoint}/route.ts`);
  const response = await GET(new Request(`http://localhost/api/${endpoint}?${new URLSearchParams(params)}`));
  assert.equal(response.status,200,`${endpoint}: ${await response.clone().text()}`);
  return response.json();
}

test('platform inventory covers every platform-bearing table, not just a three-platform paid mart',async () => {
  fixture.database.run('SAVEPOINT inventory');
  try {
    fixture.database.run("UPDATE mart_demo_paid_media_daily SET platform = CASE WHEN rowid % 3 = 0 THEN 'Meta' WHEN rowid % 3 = 1 THEN 'LinkedIn' ELSE 'X' END");
    fixture.database.run("UPDATE mart_vendor_media_daily SET platform = 'Vendor-only DSP' WHERE rowid = 1");
    const body = await request('filters');
    assert.ok(body.platforms.includes('Vendor-only DSP'));
    for (const name of ['Meta','LinkedIn','X','Google Ads','The Trade Desk']) assert.ok(body.platforms.includes(name),name);
    assert.equal(new Set(body.platforms.map((name:string) => name.toLowerCase())).size,body.platforms.length);
    assert.ok(body.platforms.length > 3);
  } finally { fixture.database.run('ROLLBACK TO inventory'); fixture.database.run('RELEASE inventory'); }
  const body = await request('filters');
  assert.deepEqual(body.platforms, platformOptions(rawOptions));
  const {DATA_DATES} = await import('../src/lib/server/filter-catalog');
  const earliest = Object.entries(DATA_DATES).flatMap(([table,col]) => csvRows(table).map(row => date(row[col]))).sort()[0];
  const latest = Object.entries(DATA_DATES).flatMap(([table,col]) => csvRows(table).map(row => date(row.window_end || row[col]))).sort().at(-1);
  assert.deepEqual(body.dateRange,{min:earliest,max:latest});
});

for (const platform of platformOptions(rawOptions)) {
  test(`platform ${platform}: delivery, reach, ads and social rows match source aliases`,async () => {
    const paid = await request('paid-media',{platform});
    const aliases = platformAliases(platform);
    const match = (row:Record<string,string>) => aliases.includes(row.platform.trim().toLowerCase());
    assert.equal(paid.kpis.spend,money(sum(csvRows('mart_demo_paid_media_daily').filter(match),'spend_usd')));
    assert.equal(paid.kpis.uniqueReach,sum(csvRows('mart_demo_paid_reach_window').filter(row => row.window_type === '28-day' && match(row)),'unique_reach'));
    assert.ok(paid.ads.every((row:{platform:string}) => aliases.includes(row.platform.trim().toLowerCase())));
    const digital = await request('digital',{platform});
    assert.equal(digital.socialKpis.posts,csvRows('dim_social_campaign').filter(match).length);
  });
}

test('case and whitespace aliases behave identically across requests',async () => {
  for (const alias of ['Meta',' meta ','META ADS','Facebook','Instagram Ads']) {
    const body = await request('paid-media',{platform:alias});
    const expected = await request('paid-media',{platform:'Meta'});
    assert.deepEqual(body,expected);
  }
  assert.equal(canonicalPlatform(' Twitter Ads '),'X');
  assert.equal(canonicalPlatform('Independent DSP'),'Independent DSP');
  assert.deepEqual(platformAliases('toString'),['tostring']);
  assert.equal((await request('paid-media',{platform:'toString'})).kpis.spend,0);
});

test('market reaches revenue, targets, customers, direct mail, offline, branches, ads and brand',async () => {
  const params = {market:market.market_id};
  const overview = await request('overview',params);
  assert.equal(overview.kpis.contribution,money(sum(csvRows('mart_demo_relationship_value_monthly').filter(row => row.market_id===market.market_id),'net_relationship_contribution_usd')));
  // Paid spend has no market grain and must not be fabricated by joining ads.
  assert.equal(overview.kpis.spend,(await request('overview')).kpis.spend);
  const targets = await request('targets',params);
  assert.equal(targets.kpis.targetFunded,sum(csvRows('mart_sales_target_attainment_monthly').filter(row => row.market_id===market.market_id),'target_funded_accounts'));
  assert.ok(targets.byMarket.every((row:{marketId:string}) => row.marketId===market.market_id));
  const customers = await request('customers',params);
  assert.ok(customers.byMarket.every((row:{marketId:string}) => row.marketId===market.market_id));
  const omni = await request('omnichannel',params);
  assert.equal(omni.kpis.dmDelivered,sum(csvRows('mart_direct_mail_performance_monthly').filter(row => row.addr_market===market.market_id),'delivered_jobs'));
  assert.equal(omni.branchDirectory.length,csvRows('dim_branch').filter(row => row.market_code===market.market_id).length);
  assert.ok(omni.branchDirectory.every((row:{market:string}) => row.market===market.market_display_name));
  const ads = await request('paid-media',params);
  assert.ok(ads.ads.every((row:{market:string}) => row.market===market.market_id));
  const brand = await request('brand',params);
  assert.equal(brand.waves.length,csvRows('mart_brand_survey_wave').filter(row => row.market_code===market.market_id).length);
});

test('product filters direct product measures and campaign-linked measures without losing intersections',async () => {
  const keys = csvRows('dim_campaign').filter(row => row.product_id===product).map(row => row.campaign_key);
  const paid = await request('paid-media',{product});
  assert.equal(paid.kpis.spend,money(sum(csvRows('mart_demo_paid_media_daily').filter(row => keys.includes(row.campaign_key)),'spend_usd')));
  const campaigns = await request('campaigns',{product});
  assert.ok(campaigns.rows.every((row:{campaignKey:string}) => keys.includes(row.campaignKey)));
  const revenue = await request('contribution',{product});
  assert.equal(revenue.kpis.netContribution,money(sum(csvRows('mart_demo_relationship_value_monthly').filter(row => row.product_id===product),'net_relationship_contribution_usd')));
  const other = csvRows('dim_campaign').find(row => row.product_id !== product)!;
  assert.equal((await request('paid-media',{product,campaign:other.campaign_key})).kpis.spend,0);
});

test('segment filters customers and acquisition denominators, leaving non-segmented contribution intact',async () => {
  const customers = await request('customers',{segment});
  assert.ok(customers.bySegment.every((row:{segmentId:string}) => row.segmentId===segment));
  assert.equal(customers.kpis.newCustomers,sum(csvRows('mart_new_funded_customers_monthly').filter(row => row.segment_id===segment),'new_funded_customers'));
  const contribution = await request('contribution',{segment});
  assert.equal(contribution.kpis.netContribution,(await request('contribution')).kpis.netContribution);
  assert.deepEqual(parametersForReport('paid-media',{segment,market:market.market_id}),{market:market.market_id});
});

test('campaign monthly totals reconcile to the filtered roster, including cross-sell product rows',async () => {
  fixture.database.run('SAVEPOINT cross_sell');
  try {
    const other = csvRows('dim_campaign').find(row => row.product_id!==product)!;
    fixture.database.run('UPDATE mart_demo_relationship_value_monthly SET product_id = :product WHERE campaign_key = :campaign',{':product':product,':campaign':other.campaign_key});
    const cases: Record<string,string>[] = [{product},{product,platform:'Meta'},{product,from:'2025-01-01',to:'2025-03-31'}];
    for (const params of cases) {
      const body = await request('campaigns',params);
      assert.equal(money(body.monthly.reduce((n:number,row:{spend:number}) => n+row.spend,0)),money(body.rows.reduce((n:number,row:{spend:number}) => n+row.spend,0)));
      assert.equal(money(body.monthly.reduce((n:number,row:{contribution:number}) => n+row.contribution,0)),money(body.rows.reduce((n:number,row:{contribution:number}) => n+row.contribution,0)));
    }
  } finally { fixture.database.run('ROLLBACK TO cross_sell'); fixture.database.run('RELEASE cross_sell'); }
});

test('date range filters social posts, overlapping reach windows, experiments and target overrides',async () => {
  const params = {from:'2025-01-01',to:'2025-01-31'};
  const digital = await request('digital',params);
  assert.equal(digital.socialKpis.posts,csvRows('dim_social_campaign').filter(row => date(row.publish_dt)>=params.from && date(row.publish_dt)<=params.to).length);
  const paid = await request('paid-media',params);
  const reach = csvRows('mart_demo_paid_reach_window').filter(row => row.window_type==='28-day' && date(row.window_start)<=params.to && date(row.window_end)>=params.from);
  assert.equal(paid.kpis.uniqueReach,sum(reach,'unique_reach'));
  const experiments = await request('experiments',params);
  const expected = csvRows('mart_demo_experiment_variant').filter(row => date(row.window_start)<=params.to && date(row.window_end)>=params.from);
  assert.equal(experiments.summary.total,new Set(expected.map(row => row.experiment_id)).size);
  const targets = await request('targets',params);
  assert.ok(targets.overrides.every((row:{month:string}) => row.month==='2025-01'));
  for (const endpoint of ['paid-media','digital','brand','experiments','targets']) {
    const empty = await request(endpoint,{from:'2099-01-01',to:'2099-12-31'});
    assert.ok(empty);
    if (endpoint==='experiments') assert.equal(empty.summary.total,0);
    if (endpoint==='brand') assert.equal(empty.waves.length,0);
    if (endpoint==='paid-media') assert.equal(empty.kpis.uniqueReach,0);
  }
});

test('campaign and platform cohorts constrain linked facts while preserving attribution rules',async () => {
  const params = {platform:'Meta'};
  const f = await parseFilters(new Request('http://localhost/api/contribution?platform=Meta'));
  const revenue = await request('contribution',params);
  const expected = csvRows('mart_demo_relationship_value_monthly').filter(row => f.platformCampaigns!.includes(row.campaign_key));
  assert.equal(revenue.kpis.netContribution,money(sum(expected,'net_relationship_contribution_usd')));
  const campaign = csvRows('dim_campaign')[0].campaign_key;
  const funnel = await request('funnel',{campaign});
  const rows = csvRows('mart_demo_submission_funnel').filter(row => [campaign,'UNATTRIBUTED'].includes(row.campaign_key));
  assert.equal(funnel.stages[0].value,sum(rows,'submissions'));
  const experiments = await request('experiments',{campaign});
  assert.ok(experiments.experiments.every((row:{campaignKey:string}) => row.campaignKey===campaign));
  const brand = await request('brand',{campaign});
  assert.ok(brand.waves.every((row:{campaignKey:string}) => row.campaignKey===campaign));
});

test('experiment filters retain control definitions even when resolution metadata is incomplete',async () => {
  fixture.database.run('SAVEPOINT control_definition');
  try {
    fixture.database.run("UPDATE dim_web_experiment_variant SET resolved_campaign_key = NULL WHERE variant = 'Control'");
    const campaign = csvRows('mart_demo_experiment_variant')[0].campaign_key;
    const body = await request('experiments',{campaign});
    assert.ok(body.experiments.length > 0);
    for (const experiment of body.experiments) {
      assert.ok(experiment.variants.some((variant:{variant:string}) => variant.variant==='Control'));
      const expected = csvRows('mart_demo_experiment_variant').filter(row => row.experiment_id===experiment.experimentId);
      assert.equal(experiment.variants.reduce((n:number,variant:{eligible:number}) => n+variant.eligible,0),sum(expected,'eligible_units'));
    }
  } finally { fixture.database.run('ROLLBACK TO control_definition'); fixture.database.run('RELEASE control_definition'); }
});

test('brand date filters never manufacture lift when a pre/post pair is incomplete',async () => {
  const row = csvRows('mart_brand_survey_wave')[0];
  const body = await request('brand',{from:date(row.survey_date),to:date(row.survey_date),campaign:row.resolved_campaign_key});
  const waves = new Map<string,Set<string>>();
  for (const wave of body.waves) {
    const set = waves.get(wave.campaignKey) ?? new Set<string>(); set.add(wave.wave); waves.set(wave.campaignKey,set);
  }
  for (const lift of body.lift) assert.ok(waves.get(lift.campaignKey)?.has('Pre-Wave') && waves.get(lift.campaignKey)?.has('Post-Wave'));
});

test('e-commerce ignores unsupported dimensions consistently in the UI projection and server',async () => {
  const base = await request('ecom',{from:'2025-01-01',to:'2025-03-31'});
  assert.deepEqual(await request('ecom',{from:'2025-01-01',to:'2025-03-31',campaign:'missing',platform:'missing',market:'missing',product:'missing',segment:'missing'}),base);
  assert.deepEqual(parametersForReport('ecom',{platform:'Meta',market:'x',product:'x',segment:'x',from:'2025-01-01'}),{from:'2025-01-01'});
});

for (const endpoint of endpoints) {
  test(`${endpoint}: combined valid filters, empty intersection, and clear restore results`,async () => {
    const params = {from:'2024-01-01',to:'2025-06-30',campaign:csvRows('dim_campaign')[0].campaign_key,platform:'Meta',market:market.market_id,product,segment};
    const base = await request(endpoint);
    const combined = await request(endpoint,params);
    responses[endpoint]=combined;
    // Returning to the unfiltered request must never retain a prior filter.
    assert.deepEqual(await request(endpoint),base);
    const missing = await request(endpoint,{campaign:'__absent__',platform:'__absent__',market:'__absent__',product:'__absent__',segment:'__absent__'});
    assert.ok(missing);
    if (FILTER_CAPABILITIES[endpoint].supported.includes('platform')) {
      const f = await parseFilters(new Request(`http://localhost/api/${endpoint}?platform=__absent__`));
      assert.deepEqual(f.platformCampaigns,[]);
    }
  });
}

test('filter state preserves selections between reports and clears all dimensions atomically',() => {
  useFilterStore.getState().reset();
  useFilterStore.getState().setDataRange({min:'2024-01-01',max:'2025-06-30'});
  useFilterStore.getState().setPlatform('Meta');
  useFilterStore.getState().setMarket(market.market_id);
  useFilterStore.getState().setProduct(product);
  useFilterStore.getState().setSegment(segment);
  const params = useFilterStore.getState().toParams();
  assert.equal(parametersForReport('ecom',params).platform,undefined);
  assert.equal(parametersForReport('customers',params).platform,'Meta');
  assert.equal(useFilterStore.getState().platform,'Meta');
  const range = useFilterStore.getState().rangePreset;
  useFilterStore.getState().clearDimensions();
  assert.equal(useFilterStore.getState().hasActiveFilters(),false);
  assert.equal(useFilterStore.getState().rangePreset,range);
});

test('normalized SQL platform filters remain bound, reject non-strings, and preserve case-independent matches',async () => {
  const statement = compileWhere('mart_demo_paid_media_daily',{platform:{normalizedIn:[" Meta Ads ","x' OR 1=1 --"]}});
  assert.match(statement.sql,/LOWER\(TRIM\(`platform`\)\) IN/);
  assert.equal(statement.parameters.p0,'meta ads');
  assert.doesNotMatch(statement.sql,/OR 1=1/);
  assert.throws(() => compileWhere('mart_demo_paid_media_daily',{spendUsd:{normalizedIn:['1']}}));
  const db = createRepositories(fixture.execute);
  assert.equal((await db.paidMediaDaily.selectRows({where:tableWhere('PaidMediaDaily',{platform:'Meta'})})).length,csvRows('mart_demo_paid_media_daily').filter(row => canonicalPlatform(row.platform)==='Meta').length);
});

test('capture real route responses for browser checks of filter-driven KPI changes',async () => {
  const filterOptions = await request('filters');
  const dimensions = {campaign:csvRows('dim_campaign')[0].campaign_key,platform:'Meta',market:market.market_id,product,segment};
  const cases: Record<string,Record<string,string>> = {none:{},combined:dimensions,...Object.fromEntries(Object.entries(dimensions).map(([key,value]) => [key,{[key]:value}]))};
  const scenarios: Record<string,Record<string,unknown>> = {};
  for (const endpoint of endpoints) {
    scenarios[endpoint] = {};
    for (const params of Object.values(cases)) {
      const projected = parametersForReport(endpoint,params);
      const key = JSON.stringify(Object.entries(projected).sort(([a],[b]) => a.localeCompare(b)));
      scenarios[endpoint][key] = await request(endpoint,{from:filterOptions.dateRange.min,to:filterOptions.dateRange.max,...projected});
    }
    if (endpoint==='paid-media') for (const platform of filterOptions.platforms) {
      const key = JSON.stringify([['platform',platform]]);
      scenarios[endpoint][key] = await request(endpoint,{from:filterOptions.dateRange.min,to:filterOptions.dateRange.max,platform});
    }
  }
  fs.mkdirSync('tests/generated',{recursive:true});
  fs.writeFileSync('tests/generated/filter-scenarios.json',JSON.stringify({filterOptions,dimensions,scenarios}));
});
