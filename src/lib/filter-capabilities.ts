export type FilterKey = 'date' | 'campaign' | 'platform' | 'market' | 'product' | 'segment';
const campaign = ['date', 'campaign', 'platform', 'product'] as const;
export const FILTER_CAPABILITIES: Record<string, { supported: readonly FilterKey[]; note: string }> = {
  overview: { supported: [...campaign, 'market'], note: 'Market narrows contribution and targets. Platform narrows delivery directly and other campaign measures through linked campaigns. Campaign-filtered funnel and web measures retain unattributed rows for coverage.' },
  campaigns: { supported: [...campaign, 'market'], note: 'Product selects campaign ownership and product-level contribution. Market narrows contribution; campaign-level spend has no market breakdown.' },
  'paid-media': { supported: [...campaign, 'market'], note: 'Market applies to the ad registry. Reach includes 28-day windows overlapping the selected dates. Product selects campaigns for that product.' },
  funnel: { supported: campaign, note: 'Product selects linked campaigns. Unattributed funnel rows are retained for campaign coverage unless a product or platform cohort excludes them. Market and segment are not recorded in this funnel.' },
  digital: { supported: campaign, note: 'Platform filters social posts directly and web/email through linked campaigns. Product also selects linked campaigns. Market and segment are not recorded for these engagement measures.' },
  omnichannel: { supported: [...campaign, 'market'], note: 'Market filters direct mail, matching offline geography and branches. Campaign/platform/product affect campaign-linked activity; the branch directory is market-scoped.' },
  customers: { supported: [...campaign, 'market', 'segment'], note: 'Market and segment filter the customer base. Date/campaign/product filter acquisition measures; platform selects linked campaigns. Contribution has no customer-segment breakdown.' },
  contribution: { supported: [...campaign, 'market', 'segment'], note: 'Market and product filter contribution directly; platform selects linked campaigns. Segment applies to newly funded customers, not revenue attribution.' },
  finance: { supported: campaign, note: 'Campaign, platform and product filter spend comparisons. Invoice/GL reconciliation is available only at month/currency/status grain and follows the date range.' },
  targets: { supported: [...campaign, 'market'], note: 'Market, product and date filter targets and override candidates. Campaign/platform narrow contribution through linked campaigns; they do not allocate targets to campaigns.' },
  brand: { supported: [...campaign, 'market'], note: 'Date and market filter survey waves. Platform and product select linked campaigns.' },
  experiments: { supported: campaign, note: 'Date selects experiments whose windows overlap the range; variant counts retain their whole-window meaning. Platform and product select linked campaigns. Market and segment are unavailable.' },
  ecom: { supported: ['date'], note: 'Order totals are available by month and status. Campaign, platform, market, banking product and customer segment are unavailable at this grain; the product catalogue is a reference list.' },
};

export function parametersForReport(report: string, params: Record<string, string | undefined>): Record<string, string> {
  const supported = FILTER_CAPABILITIES[report]?.supported ?? [];
  return Object.fromEntries(Object.entries(params).filter(([key, value]) => value && supported.includes((key === 'from' || key === 'to' ? 'date' : key) as FilterKey))) as Record<string, string>;
}
