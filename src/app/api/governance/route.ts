import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/governance — campaign resolution crosswalk, source
// coverage, acceptance checks, use-case/table map, KPI dictionary,
// lineage layers and FX rates.
// (GovernanceResponse contract; see src/lib/api-types.ts)
// Query params are intentionally ignored.
// Sources: the 7 resolution-bearing dims
// (dim_email_campaign, dim_paid_ad, dim_paid_source_campaign,
// dim_programmatic_creative, dim_social_campaign,
// dim_vendor_campaign, dim_web_experiment_variant),
// mart_campaign_attribution_coverage,
// ref_source_acceptance_check, ref_fx_rate.
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { GovernanceResponse } from "@/lib/api-types";
import { parseFilters } from "@/lib/server/filters";
import { dateKey, monthKey, round2, groupBy, sumBy } from "@/lib/server/helpers";

export const dynamic = "force-dynamic";

/** Normalized resolution-bearing dim row (dim_paid_ad has no
 *  mappingSourceSystem/campaignMatchToken columns, so its platform
 *  and sourceCampaignId stand in for system/token). */
interface CrosswalkRow {
  system: string;
  token: string;
  status: string;
  resolved: boolean;
  table: string;
}

/** gold_business table kind from its name prefix. */
function tableKind(table: string): string {
  if (table.startsWith("dim_")) return "Dimension";
  if (table.startsWith("mart_")) return "Mart";
  return "Reference";
}

async function handleGet(req: Request) {
  const f = await parseFilters(req); // filters intentionally ignored for governance
  void f;

  const [
    emailRows,
    adRows,
    paidSourceRows,
    programmaticRows,
    socialRows,
    vendorCampaignRows,
    webExperimentRows,
    coverageRows,
    acceptanceRows,
    fxRows,
  ] = await Promise.all([
    db.emailCampaign.selectRows({
      select: {
        mappingSourceSystem: true,
        campaignMatchToken: true,
        resolvedCampaignKey: true,
        campaignResolutionStatus: true,
      },
    }),
    db.paidAd.selectRows({
      select: {
        platform: true,
        sourceCampaignId: true,
        resolvedCampaignKey: true,
        campaignResolutionStatus: true,
      },
    }),
    db.paidSourceCampaign.selectRows({
      select: {
        mappingSourceSystem: true,
        campaignMatchToken: true,
        resolvedCampaignKey: true,
        campaignResolutionStatus: true,
      },
    }),
    db.programmaticCreative.selectRows({
      select: {
        mappingSourceSystem: true,
        campaignMatchToken: true,
        resolvedCampaignKey: true,
        campaignResolutionStatus: true,
      },
    }),
    db.socialCampaign.selectRows({
      select: {
        mappingSourceSystem: true,
        campaignMatchToken: true,
        resolvedCampaignKey: true,
        campaignResolutionStatus: true,
      },
    }),
    db.vendorCampaign.selectRows({
      select: {
        mappingSourceSystem: true,
        campaignMatchToken: true,
        resolvedCampaignKey: true,
        campaignResolutionStatus: true,
      },
    }),
    db.webExperimentVariant.selectRows({
      select: {
        mappingSourceSystem: true,
        campaignMatchToken: true,
        resolvedCampaignKey: true,
        campaignResolutionStatus: true,
      },
    }),
    db.campaignAttributionCoverage.selectRows(),
    db.sourceAcceptanceCheck.selectRows(),
    db.fxRate.selectRows({ orderBy: { rateDate: "asc" } }),
  ]);

  const all: CrosswalkRow[] = [
    ...emailRows.map((r) => ({
      system: r.mappingSourceSystem,
      token: r.campaignMatchToken,
      status: r.campaignResolutionStatus,
      resolved: r.resolvedCampaignKey !== null,
      table: "dim_email_campaign",
    })),
    ...adRows.map((r) => ({
      system: r.platform,
      token: r.sourceCampaignId,
      status: r.campaignResolutionStatus,
      resolved: r.resolvedCampaignKey !== null,
      table: "dim_paid_ad",
    })),
    ...paidSourceRows.map((r) => ({
      system: r.mappingSourceSystem,
      token: r.campaignMatchToken,
      status: r.campaignResolutionStatus,
      resolved: r.resolvedCampaignKey !== null,
      table: "dim_paid_source_campaign",
    })),
    ...programmaticRows.map((r) => ({
      system: r.mappingSourceSystem,
      token: r.campaignMatchToken,
      status: r.campaignResolutionStatus,
      resolved: r.resolvedCampaignKey !== null,
      table: "dim_programmatic_creative",
    })),
    ...socialRows.map((r) => ({
      system: r.mappingSourceSystem,
      token: r.campaignMatchToken,
      status: r.campaignResolutionStatus,
      resolved: r.resolvedCampaignKey !== null,
      table: "dim_social_campaign",
    })),
    ...vendorCampaignRows.map((r) => ({
      system: r.mappingSourceSystem,
      token: r.campaignMatchToken,
      status: r.campaignResolutionStatus,
      resolved: r.resolvedCampaignKey !== null,
      table: "dim_vendor_campaign",
    })),
    ...webExperimentRows.map((r) => ({
      system: r.mappingSourceSystem,
      token: r.campaignMatchToken,
      status: r.campaignResolutionStatus,
      resolved: r.resolvedCampaignKey !== null,
      table: "dim_web_experiment_variant",
    })),
  ];

  // ---------- crosswalk ----------
  const crosswalk: GovernanceResponse["crosswalk"] = {
    total: all.length,
    resolved: all.filter((r) => r.status === "Resolved").length,
    pending: all.filter((r) => r.status === "Pending" || r.status === "Unresolved").length,
    proposed: all.filter((r) => r.status === "Proposed").length,
    bySource: Array.from(groupBy(all, (r) => r.system).entries())
      .map(([sourceSystem, rows]) => ({
        sourceSystem,
        rows: rows.length,
        resolved: rows.filter((r) => r.status === "Resolved").length,
      }))
      .sort((a, b) => b.rows - a.rows || a.sourceSystem.localeCompare(b.sourceSystem)),
  };

  // ---------- unresolved (rows with no resolved campaign key) ----------
  const unresolved: GovernanceResponse["unresolved"] = Array.from(
    groupBy(
      all.filter((r) => !r.resolved),
      (r) => `${r.system}|${r.token}`
    ).entries()
  )
    .map(([, rows]) => ({
      token: rows[0].token,
      system: rows[0].system,
      status: rows[0].status,
      affectedRows: rows.length,
      modelTable: rows[0].table,
    }))
    .sort(
      (a, b) =>
        b.affectedRows - a.affectedRows ||
        a.modelTable.localeCompare(b.modelTable) ||
        a.token.localeCompare(b.token)
    )
    .slice(0, 30);

  // ---------- resolutionStatus (coverage mart) ----------
  const resolutionStatus = Array.from(
    groupBy(coverageRows, (r) => r.campaignResolutionStatus).entries()
  )
    .map(([status, rows]) => ({
      status,
      rows: sumBy(rows, (r) => r.sourceRowCount),
      spend: round2(sumBy(rows, (r) => r.spendAmount)),
    }))
    .sort((a, b) => b.rows - a.rows);

  // ---------- coverage by platform ----------
  const coverage = Array.from(groupBy(coverageRows, (r) => r.platform).entries())
    .map(([platform, rows]) => ({
      platform,
      months: new Set(rows.map((r) => monthKey(r.reportMonth))).size,
      sourceRows: sumBy(rows, (r) => r.sourceRowCount),
      distinctCampaigns: sumBy(rows, (r) => r.distinctSourceCampaigns),
      spend: round2(sumBy(rows, (r) => r.spendAmount)),
    }))
    .sort((a, b) => b.sourceRows - a.sourceRows);

  // ---------- acceptance ----------
  const acceptance: GovernanceResponse["acceptance"] = acceptanceRows
    .map((r) => ({
      checkId: r.checkId,
      criterion: r.acceptanceCriterion,
      observed: r.observedResult,
      expected: r.expectedResult,
      status: r.status,
    }))
    .sort((a, b) => a.checkId.localeCompare(b.checkId));

  // ---------- useCaseMap (static gold_business map) ----------
  const useCaseTables: Record<string, string[]> = {
    "UC01 End-to-end campaign funnel": [
      "mart_demo_submission_funnel",
      "dim_campaign",
      "mart_demo_paid_media_daily",
    ],
    "UC02 Paid media performance": [
      "mart_demo_paid_media_daily",
      "mart_demo_paid_reach_window",
      "dim_paid_ad",
      "dim_paid_source_campaign",
      "mart_vendor_media_daily",
    ],
    "UC03 Digital engagement": [
      "mart_website_engagement_daily",
      "mart_email_engagement_daily",
      "dim_email_campaign",
      "dim_social_campaign",
    ],
    "UC04 Experimentation": [
      "mart_demo_experiment_variant",
      "dim_web_experiment_variant",
      "dim_demo_experiment_variant",
    ],
    "UC05 Offline & omnichannel": [
      "mart_offline_activity_monthly",
      "mart_direct_mail_performance_monthly",
      "dim_branch",
      "dim_vendor_campaign",
    ],
    "UC06 Customer acquisition segmentation": [
      "mart_new_funded_customers_monthly",
      "dim_customer",
      "dim_customer_segment",
      "dim_zip_geography",
    ],
    "UC07 Relationship contribution": [
      "mart_demo_relationship_value_monthly",
      "mart_banking_funded_accounts_monthly",
      "dim_product",
    ],
    "UC08 Finance reconciliation": [
      "mart_demo_finance_reconciliation_monthly",
      "mart_vendor_media_daily",
      "dim_vendor_campaign",
    ],
    "UC09 Targets & attainment": [
      "mart_sales_target_attainment_monthly",
      "ref_sales_target_override_candidate",
    ],
    "UC10 Brand lift": ["mart_brand_survey_wave"],
  };
  const useCaseMap: GovernanceResponse["useCaseMap"] = Object.entries(useCaseTables).map(
    ([useCase, tables]) => ({
      useCase,
      tables: tables.map((table) => ({ table, kind: tableKind(table) })),
    })
  );

  // ---------- kpiDictionary (reference metadata) ----------
  const kpiDictionary: GovernanceResponse["kpiDictionary"] = [
    { kpi: "Marketing spend", definition: "Eligible marketing expenditure", useCases: "UC01,02,05,08" },
    { kpi: "Impressions", definition: "Platform-reported ad impressions", useCases: "UC02" },
    { kpi: "Engagement", definition: "Defined interaction with content", useCases: "UC02,03" },
    { kpi: "Leads", definition: "Distinct qualified CRM leads", useCases: "UC01,06" },
    { kpi: "Applications", definition: "Distinct submitted applications", useCases: "UC01,06" },
    { kpi: "Funded accounts", definition: "Distinct accounts meeting funding criteria", useCases: "UC01,06" },
    { kpi: "CAC", definition: "Eligible acquisition cost / acquired funded accounts", useCases: "UC01,06" },
    { kpi: "Relationship value", definition: "Estimated income less applicable costs", useCases: "UC01,07" },
    { kpi: "ROAS", definition: "Attributed revenue / advertising spend", useCases: "UC02" },
    { kpi: "Marketing ROI", definition: "Incremental contribution less spend over spend", useCases: "UC01,07" },
    { kpi: "Target attainment", definition: "Actual / target", useCases: "UC09" },
    { kpi: "Brand lift", definition: "Post minus pre advertising awareness", useCases: "UC10" },
  ];

  // ---------- lineage (static) ----------
  const lineage: GovernanceResponse["lineage"] = [
    {
      layer: "Bronze",
      items: [
        "raw platform exports",
        "CRM & banking extracts",
        "vendor invoices & GL feeds",
        "survey panel files",
      ],
    },
    {
      layer: "Silver (DQX)",
      items: ["schema conformance", "identity resolution staging", "acceptance checks"],
    },
    {
      layer: "gold_business",
      items: [
        "39 published tables",
        "campaign resolution bridges",
        "consumption marts",
        "reference data",
      ],
    },
  ];

  // ---------- fxRates ----------
  const fxRates: GovernanceResponse["fxRates"] = fxRows.map((r) => ({
    date: dateKey(r.rateDate),
    pair: `${r.baseCcy}/${r.quoteCcy}`,
    rate: r.rate,
  }));

  const res: GovernanceResponse = {
    crosswalk,
    unresolved,
    resolutionStatus,
    coverage,
    acceptance,
    useCaseMap,
    kpiDictionary,
    lineage,
    fxRates,
  };
  return NextResponse.json(res);
}

export const GET = withApiErrors(handleGet);
