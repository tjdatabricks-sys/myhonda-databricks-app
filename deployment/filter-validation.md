# V4 filter and display validation — 23 November 2026

Branch: `codex/v4`, based on the latest pulled `codex/filter-integration`.

## Changes

- The dropdown uses distinct paid-media platform values and original source labels. A regression fixture restricts paid delivery to Meta/LinkedIn/X and verifies that vendor/dimension-only platforms are excluded from the dropdown.
- Platform aliases and casing/whitespace differences are matched with bound SQL parameters. The dropdown retains the paid-media source labels; alias matching still works across reports.
- All 13 analytical reports share a filter capability contract, used by the controls, API parameter projection and server parsing. Schema and Governance remain global views.
- Product and platform can select linked campaign cohorts where a campaign-keyed table lacks those columns. Direct market/product/segment fields retain their native grain. Scope text explains the distinction; no proportional attribution is invented.
- Previously ignored reach/ad/social/vendor/branch/brand/experiment filters are connected. Override candidates follow date ranges. Reference experiment definitions remain available so filtered results do not lose control labels.
- Clear resets dimension selections atomically while preserving date preset. Unavailable selections are disabled and excluded from that report's request/cache key, while remaining saved for supported reports.
- Campaign monthly spend/contribution checks include cross-sell rows to prevent chart totals leaking outside the selected campaign roster.

- Five aggregate CAC/ROI cards are removed across Control Tower, Campaign Performance, Customer Acquisition and Revenue & Contribution. Remaining grids reflow, while campaign-level tables and charts retain their measures.

## Checks

The final validation commands are `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:ui`, and `npm run package:databricks`.

- **60 backend/query/connection tests**: all 15 report APIs, 39 table exports, independent source totals for each supported filter, aliases, missing/empty intersections, multi-filter requests, date boundaries and window overlap, campaign coverage sentinels, product cross-sell reconciliation, incomplete brand pre/post pairs, experiment control definitions and reset/state behavior.
- **15 Chromium browser tests**: real HTTP liveness probe, all tabs, paid-media-only platform options and absence of aggregate CAC/ROI cards throughout all tabs, filter-driven visible KPI changes, chart rendering after selection/Clear, every report's enabled/disabled controls, supported query parameters, persistence across navigation, rapid changes with late responses, mobile selection/Clear and overflow checks, export links and visible warehouse errors.
- TypeScript and lint checks, optimized production build and clean deployment ZIP generation.

## Practical limits

API tests execute the real handlers, repositories and query compiler against the supplied 39-table/26,854-row synthetic fixture. The test-only SQL adapter translates three-part table identifiers and timestamp parameter casts for its in-memory relational engine. It does not certify Spark SQL execution, live warehouse performance, OAuth or Unity Catalog policies.

Browser tests serve real route-generated fixture responses and check the production UI. The app's authenticated Databricks URL was attempted but was inaccessible through the available browsing tool. Consequently, these results are **local validation, not a live workspace certification**. After deploying this branch, check `/api/filters` and exercise the controls with your actual data. Only platforms present in the paid mart are offered in the dropdown. Other sources do not expand that list.

Each report's exact filter scope is documented in the root README and beneath its controls. Market/segment cannot be inferred for totals that lack those dimensions. E-commerce's monthly order/status totals remain date-filterable; campaign/platform/market/banking-product/segment controls are disabled there. Experiment counts are whole-window measures, and platform-cohort relationship value is not platform-attributed revenue.
