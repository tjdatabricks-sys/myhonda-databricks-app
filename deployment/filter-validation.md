# Filter integration validation — 23 November 2026

Branch: `codex/filter-integration`, based on the latest pulled `codex/feature-v2`.

## Changes

- Platform discovery unions all nine gold tables with a platform column. A regression fixture restricts paid delivery to Meta/LinkedIn/X and verifies that vendor/dimension-only platforms remain available.
- Platform aliases and casing/whitespace differences are matched with bound SQL parameters. Only platform families observed in source data appear as options.
- All 13 analytical reports share a filter capability contract, used by the controls, API parameter projection and server parsing. Schema and Governance remain global views.
- Product and platform can select linked campaign cohorts where a campaign-keyed table lacks those columns. Direct market/product/segment fields retain their native grain. Scope text explains the distinction; no proportional attribution is invented.
- Previously ignored reach/ad/social/vendor/branch/brand/experiment filters are connected. Override candidates follow date ranges. Reference experiment definitions remain available so filtered results do not lose control labels.
- Clear resets dimension selections atomically while preserving date preset. Unavailable selections are disabled and excluded from that report's request/cache key, while remaining saved for supported reports.
- Campaign monthly spend/contribution checks include cross-sell rows to prevent chart totals leaking outside the selected campaign roster.

## Checks

The final validation commands are `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:ui`, and `npm run package:databricks`.

- **60 backend/query/connection tests**: all 15 report APIs, 39 table exports, independent source totals for each supported filter, aliases, missing/empty intersections, multi-filter requests, date boundaries and window overlap, campaign coverage sentinels, product cross-sell reconciliation, incomplete brand pre/post pairs, experiment control definitions and reset/state behavior.
- **14 Chromium browser tests**: real HTTP liveness probe, all tabs, discovered platform options, filter-driven visible KPI changes, chart rendering after selection/Clear, every report's enabled/disabled controls, supported query parameters, persistence across navigation, rapid changes with late responses, mobile selection/Clear and overflow checks, export links and visible warehouse errors.
- TypeScript and lint checks, optimized production build and clean deployment ZIP generation.

## Practical limits

API tests execute the real handlers, repositories and query compiler against the supplied 39-table/26,854-row synthetic fixture. The test-only SQL adapter translates three-part table identifiers and timestamp parameter casts for its in-memory relational engine. It does not certify Spark SQL execution, live warehouse performance, OAuth or Unity Catalog policies.

Browser tests serve real route-generated fixture responses and check the production UI. The app's authenticated Databricks URL was attempted but was inaccessible through the available browsing tool. Consequently, these results are **local validation, not a live workspace certification**. After deploying this branch, check `/api/filters` and exercise the controls with your actual data. Platforms without delivery records in the paid mart may legitimately show zero paid spend despite appearing in other sources.

Each report's exact filter scope is documented in the root README and beneath its controls. Market/segment cannot be inferred for totals that lack those dimensions. E-commerce's monthly order/status totals remain date-filterable; campaign/platform/market/banking-product/segment controls are disabled there. Experiment counts are whole-window measures, and platform-cohort relationship value is not platform-attributed revenue.
