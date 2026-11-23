import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/schema — gold_business schema explorer: 39 tables with
// live Unity Catalog columns, declared grain and domain metadata,
// mart registry and coverage stats. (SchemaResponse contract)
// Query params are intentionally ignored: the schema is static.
// ============================================================
import { NextResponse } from "next/server";
import { liveColumns } from "@/lib/server/metadata";
import { namespace } from "@/lib/server/config";
import { db } from "@/lib/db";
import type { SchemaResponse, SchemaTableDto } from "@/lib/api-types";
import { parseFilters } from "@/lib/server/filters";
import { groupBy, bump } from "@/lib/server/helpers";
import { GOLD_TABLES } from "@/lib/server/gold-tables";

export const dynamic = "force-dynamic";


/** Dimension tables whose primary job is campaign resolution. */
const RESOLUTION_DIMS = new Set([
  "dim_email_campaign",
  "dim_paid_ad",
  "dim_paid_source_campaign",
  "dim_programmatic_creative",
  "dim_social_campaign",
  "dim_vendor_campaign",
  "dim_web_experiment_variant",
]);

/** Declared grain (business key) per gold_business table. */
const GRAIN: Record<string, string> = {
  dim_branch: "branch_code",
  dim_campaign: "campaign_key",
  dim_customer: "customer_id",
  dim_customer_segment: "segment_id",
  dim_date: "calendar_date",
  dim_demo_customer: "customer_id",
  dim_demo_experiment_variant: "experiment_id, variant_id",
  dim_ecom_product: "sku",
  dim_email_campaign: "mapping_source_system, campaignid",
  dim_market: "market_id",
  dim_paid_ad: "source_campaign_id, ad_id",
  dim_paid_source_campaign: "mapping_source_system, campaign_match_token",
  dim_product: "product_id",
  dim_programmatic_creative: "mapping_source_system, creative_asset_id",
  dim_region: "region_id",
  dim_social_campaign: "mapping_source_system, post_campaign_ref",
  dim_vendor_campaign: "mapping_source_system, source_table, source_campaign_id",
  dim_web_experiment_variant: "test_key, variant_id",
  dim_zip_geography: "zip_code",
  mart_banking_funded_accounts_monthly: "opening_month, product_id, market_id",
  mart_brand_survey_wave: "survey_wave_id",
  mart_campaign_attribution_coverage: "report_month, platform, campaign_resolution_status",
  mart_demo_experiment_variant: "experiment_id, variant_id",
  mart_demo_finance_reconciliation_monthly: "spend_month, currency, reconciliation_status",
  mart_demo_paid_media_daily: "campaign_key, report_date, platform, format",
  mart_demo_paid_reach_window: "ad_id, window_type, reach_scope",
  mart_demo_relationship_value_monthly: "campaign_key, value_month, product_id, market_id",
  mart_demo_submission_funnel: "campaign_key, submission_month, platform, format",
  mart_direct_mail_performance_monthly: "mail_month, mapping_source_campaign_id, addr_market",
  mart_ecom_orders_monthly: "order_month, order_status",
  mart_email_engagement_daily: "cmpgn_id, send_dt",
  mart_new_funded_customers_monthly: "acquisition_month, product_id, market_id, segment_id",
  mart_offline_activity_monthly: "observation_month, source_channel, mapping_source_campaign_id, metric",
  mart_sales_target_attainment_monthly: "target_month, product_id, market_id, plan_version",
  mart_vendor_media_daily: "source_table, report_date, source_campaign_id",
  mart_website_engagement_daily: "session_date, landing_page_path, device_category",
  ref_fx_rate: "rate_date, base_ccy, quote_ccy",
  ref_sales_target_override_candidate: "target_month, product_id, market_id, plan_version",
  ref_source_acceptance_check: "check_id",
};

/** Source lineage + metric notes for the consumption marts. */
const MART_META: Record<string, { modelSources: string; metricNotes: string }> = {
  mart_banking_funded_accounts_monthly: {
    modelSources: "gold_business models (banking funded-account facts)",
    metricNotes: "Monthly opened vs funded accounts by product and market.",
  },
  mart_brand_survey_wave: {
    modelSources: "gold_business models (brand survey waves)",
    metricNotes: "Wave-level awareness, consideration and recall by market and campaign.",
  },
  mart_campaign_attribution_coverage: {
    modelSources: "gold_business models (campaign resolution bridges)",
    metricNotes: "Monthly source-row coverage and resolution status by platform.",
  },
  mart_demo_experiment_variant: {
    modelSources: "gold_business models (dim_web_experiment_variant)",
    metricNotes: "Experiment/variant eligible and converted units with primary-event rates.",
  },
  mart_demo_finance_reconciliation_monthly: {
    modelSources: "gold_business models (invoice + GL posting facts)",
    metricNotes: "Monthly invoice-to-GL reconciliation status, link counts and variance.",
  },
  mart_demo_paid_media_daily: {
    modelSources: "gold_business models (dim_paid_ad, dim_paid_source_campaign, platform delivery)",
    metricNotes: "Daily spend, impressions, clicks and reported submissions by campaign/platform/format.",
  },
  mart_demo_paid_reach_window: {
    modelSources: "gold_business models (dim_paid_ad, dim_paid_source_campaign, platform delivery)",
    metricNotes: "Unique reach and impressions per 7/28-day window by ad.",
  },
  mart_demo_relationship_value_monthly: {
    modelSources: "gold_business models (banking relationship facts)",
    metricNotes: "Monthly net interest income and relationship contribution per campaign/product/market.",
  },
  mart_demo_submission_funnel: {
    modelSources: "gold_business models (dim_campaign, CRM + banking facts)",
    metricNotes: "Monthly submission-to-funded funnel counts with duplicate and CRM-match detail.",
  },
  mart_direct_mail_performance_monthly: {
    modelSources: "gold_business models (direct mail vendor facts)",
    metricNotes: "Monthly mail jobs, delivery, response and QR-scan performance by market.",
  },
  mart_ecom_orders_monthly: {
    modelSources: "gold_business models (order facts + dim_ecom_product)",
    metricNotes: "Monthly order counts and gross/tax/shipping amounts by order status.",
  },
  mart_email_engagement_daily: {
    modelSources: "gold_business models (dim_email_campaign + ESP sends)",
    metricNotes: "Daily sends, delivery, opens, clicks, bounces and opt-outs per campaign.",
  },
  mart_new_funded_customers_monthly: {
    modelSources: "gold_business models (CRM + banking acquisition facts)",
    metricNotes: "Monthly newly funded customers by product, market and segment.",
  },
  mart_offline_activity_monthly: {
    modelSources: "gold_business models (offline channel exports)",
    metricNotes: "Monthly offline channel metrics (OOH, broadcast, events, call center).",
  },
  mart_sales_target_attainment_monthly: {
    modelSources: "gold_business models (ref_sales_target_override + banking facts)",
    metricNotes: "Monthly target vs actual funded accounts and contribution by plan version.",
  },
  mart_vendor_media_daily: {
    modelSources: "gold_business models (dim_vendor_campaign + vendor exports)",
    metricNotes: "Vendor-reported weekly spend, impressions, clicks and conversions.",
  },
  mart_website_engagement_daily: {
    modelSources: "gold_business models (web session facts)",
    metricNotes: "Daily sessions, engaged sessions and application submits by page/device.",
  },
};

interface CsvColumn {
  column_name: string;
  data_type: string;
  ordinal_position: number;
}

async function parseSchemaCsv(): Promise<Map<string, CsvColumn[]>> {
  const rows = await liveColumns();
  return groupBy(rows, row => row.table_name);
}

function tableKind(name: string): string {
  if (name.startsWith("dim_")) return "Dimension";
  if (name.startsWith("mart_")) return "Mart";
  if (name.startsWith("ref_")) return "Reference";
  return "Metadata";
}

function domainFor(name: string): string {
  if (RESOLUTION_DIMS.has(name)) return "Campaign Resolution";
  if (name.startsWith("dim_")) return "Conformed Dimensions";
  if (name.startsWith("mart_")) return "Consumption Marts";
  if (name.startsWith("ref_")) return "Reference Data";
  return "Unknown";
}

/** Warehouse repository for a PascalCase model name (e.g. "Branch" -> db.branch). */
function delegateFor(model: string): { countRows: () => Promise<number> } | undefined {
  return (db as unknown as Record<string, { countRows: () => Promise<number> }>)[
    model.charAt(0).toLowerCase() + model.slice(1)
  ];
}

async function handleGet(req: Request) {
  await parseFilters(req); // filters intentionally ignored for the schema explorer

  const columnsByTable = await parseSchemaCsv();

  const tableNames = Object.keys(GOLD_TABLES).sort();
  const rowCounts = new Map<string, number>();
  await Promise.all(
    tableNames.map(async (t) => {
      const delegate = delegateFor(GOLD_TABLES[t].model);
      rowCounts.set(t, delegate ? await delegate.countRows() : 0);
    })
  );

  const tables: SchemaTableDto[] = tableNames.map((name) => {
    const rowCount = rowCounts.get(name) ?? 0;
    return {
      tableName: name,
      tableKind: tableKind(name),
      domain: domainFor(name),
      rowCount,
      grain: GRAIN[name] ?? "-",
      note: `${rowCount} rows in ${namespace().catalog}.${namespace().schema}`,
      columns: (columnsByTable.get(name) ?? []).map((c) => ({
        name: c.column_name,
        type: c.data_type,
      })),
    };
  });

  const kindCounts = new Map<string, number>();
  for (const t of tables) bump(kindCounts, t.tableKind, 1);
  const groups = Array.from(kindCounts.entries())
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));

  const marts = tables
    .filter((t) => t.tableKind === "Mart")
    .map((t) => {
      const meta = MART_META[t.tableName];
      return {
        martTable: t.tableName,
        grainColumns: GRAIN[t.tableName] ?? "-",
        modelSources: meta?.modelSources ?? "gold_business models (conformed dimensions + facts)",
        rowCount: t.rowCount,
        metricNotes:
          meta?.metricNotes ?? "Aggregated metrics materialized from gold_business sources.",
      };
    })
    .sort((a, b) => a.martTable.localeCompare(b.martTable));

  const stats: SchemaResponse["stats"] = {
    tables: tables.length,
    columns: tables.reduce((a, t) => a + t.columns.length, 0),
    materialized: tables.filter((t) => t.rowCount > 0).length,
    totalRows: tables.reduce((a, t) => a + t.rowCount, 0),
  };

  const res: SchemaResponse = { groups, tables, marts, stats };
  return NextResponse.json(res);
}

export const GET = withApiErrors(handleGet);
