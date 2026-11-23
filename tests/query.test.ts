import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileRead, compileWhere, normalizeValue } from '../src/lib/server/query';
import { connectionSettings, quoteIdentifier } from '../src/lib/server/config';
import { compatibleType, validateColumns } from '../src/lib/server/metadata';
import { rangeParams } from '../src/lib/store';
import schema from '../data/gold-business-schema.json';

process.env.DATABRICKS_CATALOG = 'media-poc';
process.env.DATABRICKS_SCHEMA = 'gold_business';

test('SQL values are bound and identifiers are validated and quoted', () => {
  const value = "x' OR 1=1 --";
  const query = compileWhere('dim_campaign', { campaignKey: value });
  assert.equal(query.sql,'`campaign_key` = :p0');
  assert.equal(query.parameters.p0,value);
  assert.equal(quoteIdentifier('media-poc'),'`media-poc`');
  assert.equal(quoteIdentifier('a`b'),'`a``b`');
  assert.throws(() => compileWhere('dim_campaign',{ unknown: value }));
  assert.throws(() => compileRead('constructor'));
  assert.throws(() => compileWhere('dim_campaign',{ campaignKey: { contains: 'x' } }));
});

test('null OR filters, dates, sorting and distinct compile without changing semantics', () => {
  const query = compileWhere('mart_website_engagement_daily', { OR: [{resolvedCampaignKey:'C1'},{resolvedCampaignKey:null}], sessionDate:{gte:new Date('2026-01-01')} });
  assert.match(query.sql,/IS NULL/); assert.match(query.sql,/ OR /); assert.match(query.sql,/CAST\(:p1 AS TIMESTAMP\)/);
  assert.equal(query.parameters.p1,'2026-01-01T00:00:00.000Z');
  assert.match(compileRead('dim_campaign',{select:{campaignKey:true},distinct:['campaignKey'],orderBy:{campaignKey:'asc'}}).sql,/SELECT DISTINCT.*ORDER BY `campaign_key` ASC/);
  assert.throws(() => compileRead('dim_campaign',{distinct:['campaignKey']}));
});

test('warehouse dates, decimals, booleans and unsafe numbers are handled explicitly', () => {
  assert.equal((normalizeValue('DateTime','2026-01-01 10:00:00') as Date).toISOString(),'2026-01-01T10:00:00.000Z');
  assert.equal((normalizeValue('DateTime',Date.UTC(2026,0,1)) as Date).toISOString(),'2026-01-01T00:00:00.000Z');
  assert.equal(normalizeValue('Float','123.45'),123.45);
  assert.equal(normalizeValue('Boolean',false),false);
  assert.throws(() => normalizeValue('Int','9007199254740993'));
  assert.throws(() => normalizeValue('Boolean','no'));
});

test('schema validation checks all required columns and compatible types', () => {
  const columns = schema.map(row => ({...row,ordinal_position:Number(row.ordinal_position)}));
  assert.deepEqual(validateColumns(columns),[]);
  assert.match(validateColumns(columns.slice(1))[0],/dim_branch.branch_code/);
  assert.ok(compatibleType('Float','DECIMAL(20,4)'));
  assert.ok(!compatibleType('Int','STRING'));
});

test('date presets use available data, handle leap years, and clamp to minimum', () => {
  assert.deepEqual(rangeParams('30d',{min:'2024-01-01',max:'2024-03-01'}),{from:'2024-02-01',to:'2024-03-01'});
  assert.deepEqual(rangeParams('ytd',{min:'2026-10-01',max:'2026-11-23'}),{from:'2026-10-01',to:'2026-11-23'});
  assert.deepEqual(rangeParams('12m',{min:'2020-01-01',max:'2024-02-29'}),{from:'2023-03-01',to:'2024-02-29'});
});

test('warehouse hostname and HTTP path derive from the three deployment settings', () => {
  process.env.DATABRICKS_HOST='https://test.cloud.databricks.com';
  process.env.DATABRICKS_WAREHOUSE_ID='abc123';
  assert.deepEqual(connectionSettings(),{host:'test.cloud.databricks.com',path:'/sql/1.0/warehouses/abc123'});
});
