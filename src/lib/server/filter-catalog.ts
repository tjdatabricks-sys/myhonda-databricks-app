import { GOLD_TABLES } from './gold-tables';
import { qualifiedTable, quoteIdentifier } from './config';
import { queryTransport } from './warehouse';
import { normalizeValue, type Statement } from './query';
import { platformAliases } from '../platforms';

export const DATA_DATES: Record<string, string> = {
  mart_banking_funded_accounts_monthly: 'opening_month', mart_brand_survey_wave: 'survey_date',
  mart_campaign_attribution_coverage: 'report_month', mart_demo_experiment_variant: 'window_start',
  mart_demo_finance_reconciliation_monthly: 'spend_month', mart_demo_paid_media_daily: 'report_date',
  mart_demo_paid_reach_window: 'window_start', mart_demo_relationship_value_monthly: 'value_month',
  mart_demo_submission_funnel: 'submission_month', mart_direct_mail_performance_monthly: 'mail_month',
  mart_ecom_orders_monthly: 'order_month', mart_email_engagement_daily: 'send_dt',
  mart_new_funded_customers_monthly: 'acquisition_month', mart_offline_activity_monthly: 'observation_month',
  mart_sales_target_attainment_monthly: 'target_month', mart_vendor_media_daily: 'report_date',
  mart_website_engagement_daily: 'session_date',
};

export function platformInventoryStatement(): Statement {
  // Restore the original dropdown source and source labels. Other reports can
  // still match source aliases through the shared filter integration layer.
  return { sql: `SELECT DISTINCT TRIM(platform) AS platform FROM ${qualifiedTable('mart_demo_paid_media_daily')} WHERE platform IS NOT NULL AND TRIM(platform) <> ''`, parameters: {} };
}
export function dataRangeStatement(): Statement {
  return { sql: `SELECT MIN(min_date) AS minDate, MAX(max_date) AS maxDate FROM (${Object.entries(DATA_DATES).map(([table, column]) => {
    const end = table === 'mart_demo_experiment_variant' || table === 'mart_demo_paid_reach_window' ? 'window_end' : column;
    return `SELECT MIN(${quoteIdentifier(column)}) AS min_date, MAX(${quoteIdentifier(end)}) AS max_date FROM ${qualifiedTable(table)}`;
  }).join(' UNION ALL ')}) AS data_dates`, parameters: {} };
}
export async function loadFilterCatalog() {
  const [platforms, dates] = await Promise.all([queryTransport.execute(platformInventoryStatement()), queryTransport.execute(dataRangeStatement())]);
  const today = new Date().toISOString().slice(0, 10);
  const min = normalizeValue('DateTime', dates[0]?.minDate) as Date | null;
  const max = normalizeValue('DateTime', dates[0]?.maxDate) as Date | null;
  const options = [...new Set(platforms.flatMap(row => typeof row.platform === 'string' && row.platform.trim() ? [row.platform.trim()] : []))].sort((a, b) => a.localeCompare(b));
  return { platforms: options, dateRange: { min: min?.toISOString().slice(0, 10) ?? today, max: max?.toISOString().slice(0, 10) ?? today } };
}

export function platformCampaignStatement(platform: string): Statement {
  const aliases = platformAliases(platform);
  const parameters = Object.fromEntries(aliases.map((alias, i) => [`p${i}`, alias]));
  const match = `LOWER(TRIM(platform)) IN (${aliases.map((_, i) => ':p' + i).join(', ')})`;
  const parts = Object.entries(GOLD_TABLES).flatMap(([table, def]) => def.fields.platform ? Object.entries(def.fields).filter(([, field]) => field === 'campaignKey' || field === 'resolvedCampaignKey').map(([column]) => `SELECT ${quoteIdentifier(column)} AS campaignKey FROM ${qualifiedTable(table)} WHERE ${match}`) : []);
  return { sql: `SELECT DISTINCT campaignKey FROM (${parts.join(' UNION ALL ')}) AS campaign_keys WHERE campaignKey IS NOT NULL AND campaignKey <> 'UNATTRIBUTED'`, parameters };
}
let platformCache = new Map<string, { at: number; promise: Promise<string[]> }>();
export async function campaignsForPlatform(platform: string): Promise<string[]> {
  const key = platformAliases(platform).join('|');
  const cached = platformCache.get(key);
  if (cached && Date.now() - cached.at < 60000) return cached.promise;
  const promise = queryTransport.execute(platformCampaignStatement(platform)).then(rows => rows.map(row => String(row.campaignKey)).filter(Boolean));
  // Bound cache cardinality even if callers supply arbitrary platform strings.
  if (platformCache.size >= 100) platformCache = new Map();
  const entry = { at: Date.now(), promise };
  platformCache.set(key, entry);
  try { return await promise; } catch (error) { if (platformCache.get(key) === entry) platformCache.delete(key); throw error; }
}
