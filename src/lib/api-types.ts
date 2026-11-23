// ============================================================
// API contract types — shared between API routes and frontend tabs
// All rates are decimals (0.045 = 4.5%). Months are "YYYY-MM".
// Money values are plain numbers (USD); frontend formats them.
// Sourced exclusively from the gold_business schema
// (upload/07_gold_to_gold_business.csv — 39 tables / 468 columns).
// ============================================================

// ---------- shared ----------
export interface CampaignOption { campaignKey: string; campaignTitle: string; channelGroup: string; initiativeType: string }
export interface MarketOption { marketId: string; marketDisplayName: string; regionId: string }
export interface ProductOption { productId: string; productName: string; productCategory: string }
export interface SegmentOption { segmentId: string; segment: string; segmentGroup: string }

export interface FiltersResponse {
  campaigns: CampaignOption[];
  platforms: string[];
  markets: MarketOption[];
  products: ProductOption[];
  segments: SegmentOption[];
  dateRange: { min: string; max: string };
  totals: { campaigns: number; tables: number; goldRows: number; fundedAccounts: number };
}

// ---------- overview / control tower ----------
export interface OverviewResponse {
  kpis: {
    spend: number; impressions: number; clicks: number; submissions: number; leads: number;
    applications: number; fundedAccounts: number; cac: number; contribution: number; roi: number; ctr: number; cpc: number;
  };
  deltas: { spend: number; leads: number; fundedAccounts: number; cac: number; contribution: number };
  monthly: { month: string; spend: number; leads: number; applications: number; fundedAccounts: number; contribution: number }[];
  channelMix: { channel: string; spend: number; fundedAccounts: number; cac: number }[];
  funnel: { stage: string; value: number; rate: number }[];
  platformTable: { platform: string; spend: number; impressions: number; clicks: number; ctr: number; cpc: number; cpm: number; submissions: number; fundedAccounts: number }[];
  topCampaigns: { campaignKey: string; campaignTitle: string; channelGroup: string; spend: number; fundedAccounts: number; cac: number; contribution: number; roi: number }[];
  attainment: { targetFunded: number; actualFunded: number; pct: number };
  dataQuality: { resolvedPct: number; pendingLinks: number; reconciliationRate: number; openVarianceUsd: number };
  insights: string[];
}

// ---------- campaigns ----------
export interface CampaignsResponse {
  rows: {
    campaignKey: string; campaignTitle: string; channelGroup: string; initiativeType: string; product: string;
    status: string; budget: number; spend: number; budgetPct: number; impressions: number; clicks: number; ctr: number;
    submissions: number; leads: number; applications: number; fundedAccounts: number; cac: number;
    contribution: number; roi: number; startDt: string; endDt: string;
  }[];
  scatter: { campaignKey: string; campaignTitle: string; spend: number; fundedAccounts: number; cac: number; roi: number }[];
  monthly: { month: string; spend: number; fundedAccounts: number; contribution: number }[];
  channelSummary: { channel: string; campaigns: number; spend: number; fundedAccounts: number; cac: number; roi: number }[];
}

// ---------- paid media ----------
export interface PaidMediaResponse {
  kpis: { spend: number; impressions: number; clicks: number; ctr: number; cpc: number; cpm: number; conversions: number; cpConv: number; uniqueReach: number; frequency: number };
  platform: { platform: string; spend: number; impressions: number; clicks: number; ctr: number; cpc: number; cpm: number; submissions: number; fundedAccounts: number; cac: number }[];
  daily: { date: string; spend: number; impressions: number; clicks: number }[];
  format: { format: string; spend: number; impressions: number; clicks: number; ctr: number; cpc: number; submissions: number }[];
  reach: { campaignKey: string; campaignTitle: string; platform: string; uniqueReach: number; impressions: number; frequency: number }[];
  ads: { adId: string; campaignKey: string; campaignTitle: string; platform: string; format: string; market: string; effectiveStart: string; effectiveEnd: string; resolutionStatus: string }[];
  vendorVsModel: { platform: string; modelSpend: number; vendorSpend: number; variancePct: number }[];
}

// ---------- funnel ----------
export interface FunnelResponse {
  stages: { stage: string; value: number; rate: number }[];
  monthly: { month: string; submissions: number; leads: number; qualified: number; applications: number; approved: number; opened: number; funded: number }[];
  byCampaign: {
    campaignKey: string; campaignTitle: string; platform: string; submissions: number; leads: number;
    applications: number; funded: number; leadRate: number; appRate: number; fundedRate: number; spend: number; cac: number;
  }[];
  duplicates: { submissions: number; duplicates: number; eligible: number; withoutCrm: number; matchRate: number };
}

// ---------- digital ----------
export interface DigitalResponse {
  webKpis: { sessions: number; engagedRate: number; submitRate: number; avgSessionsPerDay: number };
  webDaily: { date: string; sessions: number; engaged: number; submits: number }[];
  landingPages: { path: string; sessions: number; engagedRate: number; submitRate: number }[];
  devices: { device: string; sessions: number; engagedRate: number; submitRate: number }[];
  attribution: { status: string; sessions: number; engagedRate: number; submitRate: number }[];
  emailKpis: { sent: number; delivered: number; deliveryRate: number; openRate: number; clickRate: number; bounceRate: number; optOutRate: number };
  emailDaily: { date: string; sent: number; delivered: number; opens: number; clicks: number }[];
  emailCampaigns: { campaignKey: string; campaignTitle: string; sends: number; openRate: number; clickRate: number; optOutRate: number }[];
  socialKpis: { posts: number; platforms: number; resolvedRate: number; clearedRate: number };
  socialPlatform: { platform: string; posts: number }[];
  socialCampaigns: { postRef: string; platform: string; theme: string; postType: string; publishDate: string; goal: string; legalStatus: string; campaignTitle: string; resolutionStatus: string }[];
}

// ---------- omnichannel / offline ----------
export interface OmnichannelResponse {
  kpis: { dmDelivered: number; dmResponseRate: number; qrScanRate: number; billboardImpressions: number; doohPlays: number; tvSpots: number; calls: number; connectedRate: number; branchAttendees: number; referralCompleted: number };
  directMailMonthly: { month: string; jobs: number; delivered: number; responses: number; qrScans: number; responseRate: number; postage: number }[];
  directMailCampaigns: { campaignKey: string; campaignTitle: string; jobs: number; delivered: number; responses: number; responseRate: number; qrRate: number; cost: number; costPerResponse: number }[];
  channelActivity: { channel: string; metric: string; monthly: { month: string; value: number }[] }[];
  offlineByCampaign: { campaignKey: string; campaignTitle: string; channel: string; metrics: { metric: string; value: number }[] }[];
  callsMonthly: { month: string; calls: number; connected: number; converted: number }[];
  branchDirectory: { branchCode: string; branchName: string; market: string; type: string; status: string }[];
  vendorCampaigns: { campaign: string; platform: string; vendorSystem: string; status: string; budget: number; flight: string }[];
  channelCompare: { channel: string; spend: number; fundedAccounts: number; cac: number; contribution: number }[];
}

// ---------- customers ----------
export interface CustomersResponse {
  kpis: { newCustomers: number; leadToCustomerRate: number; avgCac: number; avgTenureMonths: number; digitalShare: number; emailOptInRate: number };
  monthly: { month: string; newFundedCustomers: number }[];
  bySegment: { segmentId: string; segment: string; segmentGroup: string; customers: number; share: number }[];
  byMarket: { marketId: string; market: string; customers: number; region: string }[];
  byProduct: { productId: string; product: string; customers: number; contribution: number }[];
  byChannel: { channel: string; customers: number }[];
  leadQuality: { campaignKey: string; campaignTitle: string; leads: number; customers: number; rate: number }[];
  segments: { segmentId: string; segment: string; segmentGroup: string; description: string; theme: string; customers: number }[];
}

// ---------- contribution ----------
export interface ContributionResponse {
  kpis: { netContribution: number; perCustomer: number; interestIncome: number; otherIncome: number; roi: number; estimated36m: number; paybackMonths: number };
  monthly: { month: string; interest: number; other: number; net: number }[];
  byProduct: { productId: string; product: string; customers: number; monthlyPerCustomer: number; contribution: number }[];
  byMarket: { marketId: string; market: string; contribution: number; customers: number }[];
  byCampaign: { campaignKey: string; campaignTitle: string; spend: number; contribution: number; roi: number; estimated36m: number }[];
  scatter: { campaignKey: string; campaignTitle: string; spend: number; contribution: number; roi: number }[];
  cohort: { cohortMonth: string; cumulativeSpend: number; cumulativeContribution: number; estimated36m: number }[];
}

// ---------- finance ----------
export interface FinanceResponse {
  kpis: { platformSpend: number; invoiced: number; glPosted: number; invoiceGlVariance: number; reconciliationRate: number; openVarianceUsd: number; pendingLinks: number };
  monthly: { month: string; platformSpend: number; invoiceNet: number; glNet: number; variance: number }[];
  statusMix: { status: string; links: number; invoiceNet: number; glNet: number }[];
  vendorLines: { sourceTable: string; platform: string; period: string; campaignTitle: string; spend: number; impressions: number; clicks: number; cpc: number; status: string }[];
  glMonthly: { month: string; glNet: number; invoiceNet: number; variance: number }[];
  varianceByCampaign: { campaignKey: string; campaignTitle: string; platformSpend: number; invoiced: number; variance: number; variancePct: number }[];
  sourceMix: { sourceTable: string; spend: number; rows: number }[];
}

// ---------- targets ----------
export interface TargetsResponse {
  kpis: { targetFunded: number; actualFunded: number; attainment: number; targetContribution: number; gap: number; monthsOnTrack: number; monthsTotal: number };
  monthly: { month: string; targetFunded: number; actualFunded: number; targetContribution: number; actualContribution: number; attainment: number }[];
  byProduct: { productId: string; product: string; target: number; actual: number; attainment: number; gap: number }[];
  byMarket: { marketId: string; market: string; target: number; actual: number; attainment: number; gap: number }[];
  overrides: { month: string; product: string; market: string; status: string; reason: string; amount: number }[];
  planVersions: { planVersion: string; targetFunded: number; actualFunded: number }[];
}

// ---------- experiments ----------
export interface ExperimentVariantDto {
  variantId: string; variant: string; allocationPct: number; eligible: number; converted: number; rate: number;
  liftAbs: number; liftRel: number; significant: boolean; confidence: number;
}
export interface ExperimentsResponse {
  experiments: {
    experimentId: string; name: string; hypothesis: string; primaryMetric: string; status: string; ownerTeam: string;
    campaignKey: string; campaignTitle: string; window: string; variants: ExperimentVariantDto[];
    bestVariant: string | null; bestLiftRel: number;
  }[];
  summary: { total: number; completed: number; running: number; winners: number; avgLift: number };
}

// ---------- brand ----------
export interface BrandResponse {
  waves: { waveId: string; campaignKey: string; campaignTitle: string; market: string; wave: string; date: string; sampleSize: number; awareness: number; consideration: number; recall: number; method: string }[];
  lift: { campaignKey: string; campaignTitle: string; channel: string; preAwareness: number; postAwareness: number; lift: number; relLift: number; considerationLift: number; recallLift: number; markets: number }[];
  byMarket: { market: string; preAwareness: number; postAwareness: number; lift: number }[];
  byMethod: { method: string; waves: number; avgLift: number }[];
  timeline: { month: string; avgAwareness: number; avgConsideration: number; avgRecall: number }[];
}

// ---------- e-commerce ----------
export interface EcomResponse {
  kpis: { orders: number; grossSales: number; netSales: number; aov: number; returnRate: number; avgTax: number; avgShipping: number };
  monthly: { month: string; orders: number; gross: number; net: number }[];
  statusMix: { status: string; orders: number; amount: number; tax: number; shipping: number }[];
  catalog: { sku: string; name: string; category: string; brand: string; listPrice: number; unitCost: number; margin: number; active: boolean }[];
  categoryPrices: { category: string; products: number; avgPrice: number; avgMargin: number }[];
}

// ---------- schema explorer ----------
export interface SchemaTableDto {
  tableName: string; tableKind: string; domain: string; rowCount: number; grain: string; note: string;
  columns: { name: string; type: string }[];
}
export interface SchemaResponse {
  groups: { kind: string; count: number }[];
  tables: SchemaTableDto[];
  marts: { martTable: string; grainColumns: string; modelSources: string; rowCount: number; metricNotes: string }[];
  stats: { tables: number; columns: number; materialized: number; totalRows: number };
}

// ---------- governance ----------
export interface GovernanceResponse {
  crosswalk: { total: number; resolved: number; pending: number; proposed: number; bySource: { sourceSystem: string; rows: number; resolved: number }[] };
  unresolved: { token: string; system: string; status: string; affectedRows: number; modelTable: string }[];
  resolutionStatus: { status: string; rows: number; spend: number }[];
  coverage: { platform: string; months: number; sourceRows: number; distinctCampaigns: number; spend: number }[];
  acceptance: { checkId: string; criterion: string; observed: string; expected: string; status: string }[];
  useCaseMap: { useCase: string; tables: { table: string; kind: string }[] }[];
  kpiDictionary: { kpi: string; definition: string; useCases: string }[];
  lineage: { layer: string; items: string[] }[];
  fxRates: { date: string; pair: string; rate: number }[];
}
