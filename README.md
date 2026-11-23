# myhonda Marketing IQ — Databricks Apps

Next.js / React analytics application with 15 tabs, 17 data API routes, live Unity Catalog metadata, and CSV exports. All application data comes from the configured Databricks SQL warehouse. No Z.ai service, Bun runtime, Caddy proxy, Prisma ORM, or local database is required.

## Deploy in Databricks

1. Create a Databricks App in the workspace that contains your SQL warehouse.
2. Add an existing SQL warehouse as an app resource, with resource key **`sql-warehouse`** and **Can use** permission.
3. In `app.yaml`, set `DATABRICKS_CATALOG` and `DATABRICKS_SCHEMA`. The defaults are `media-poc` and `gold_business`. The warehouse ID comes from the resource binding; the workspace host and OAuth credentials come from Databricks automatically.
4. Grant the app service principal `USE CATALOG`, `USE SCHEMA`, and `SELECT` on the required tables. Its identity is on the app's Authorization tab. Use `deployment/grants.sql` as the template.
5. Extract `dist/myhonda-databricks-app.zip` locally and upload/sync its **contents** into a workspace source folder. `app.yaml` and `package.json` must be at that folder's root. Select that folder as the app source and deploy. Do not upload the ZIP as the app's only source file.
6. Check the deployment logs and open the app. `/api/health` must return HTTP 200 with `status: ready`. It validates all 39 required tables, column types, and SELECT access. Missing configuration, unavailable compute, and missing grants return HTTP 503 with a diagnostic instead of silently loading sample data.

Databricks installs Node packages and builds Next.js from source. The start script also builds if the standalone server does not exist, copies static assets, and binds to `0.0.0.0:$DATABRICKS_APP_PORT`. No PAT is needed in deployed operation. Do not add `NODE_ENV=production` to the build environment unless all required build dependencies are installed; the package lists build dependencies under `dependencies`.

The only app-specific connection choices are **warehouse, catalog, and schema**. Resource grants, app creation and deployment still require a developer or administrator with the appropriate workspace permissions. The chosen schema must already contain the business data described by `data/gold-business-schema.csv` (39 tables, 468 columns). This is a consumption app; it does not create or populate production tables, run ETL, or invent missing data.

## Identity and data access

Queries use the app's service principal through OAuth M2M. Every person allowed to use the app sees data available to that principal, including row-level exports. Grant app access accordingly. This implementation does not forward individual user tokens; per-user Unity Catalog permissions would require a separate authorization change.

Connection values are server-only. Filters use bound named parameters; table/column names come from a fixed schema allowlist. Catalog names such as `media-poc` are quoted correctly. API errors exclude raw SQL, filter values, driver messages and credentials. The diagnostics identify configuration/schema issues without logging customer rows.

## Local development

Use Node.js 22 or newer (Databricks Apps currently supplies Node.js 22).

```sh
npm ci
```

Copy `.env.example` to `.env.local`, set the workspace URL, warehouse ID, catalog, schema and a local development PAT. Alternatively remove `DATABRICKS_TOKEN` and set OAuth client credentials. Never commit local secrets. Local credentials must have equivalent data permissions to the app service principal.

```sh
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

The production server defaults to port 8000 locally. `PORT` overrides it; `DATABRICKS_APP_PORT` takes precedence. The development server defaults to port 3000. All application routes use Node.js; no Python backend is needed. Fonts use local system fallbacks so the build does not fetch Google Fonts.

## Validation and tests

`npm test` runs the actual route handlers and query compiler against all supplied sample CSVs using a test-only in-memory relational engine. It checks all 15 tabs, filter boundaries and attribution rules, selected KPI totals, schema validation, failure responses, and all 39 complete CSV exports. These tests do **not** establish a live Databricks connection and do not certify Spark SQL dialect, OAuth, networking, or Unity Catalog grants.

`npm run test:ui` runs Playwright against a production build, using the API responses produced by `npm test`. It exercises tab navigation, filters, export links, mobile navigation and the warehouse error state. Complete CSV response contents are checked separately by the backend tests. Install Chromium with `npx playwright install chromium` if it is unavailable. Generated test responses, screenshots and reports stay outside the deployment archive.

## Runtime behavior and limits

- Date presets end at the latest paid-media date in the connected warehouse and clamp to its earliest date. They no longer use fixed demo dates. Empty paid-media tables use today's UTC date as the neutral range.
- The app preserves existing domain-specific filter semantics: for example, some marts lack market/platform/segment columns; those filters apply only where the underlying table supports them. The funnel retains `UNATTRIBUTED` rows, and website/offline filters retain the original null-attribution rules. Experiments and Brand Lift keep their existing unfiltered navigation behavior.
- Warehouse queries run with isolated sessions on one reusable OAuth client, at most four at a time, with a bounded waiting queue. `DATABRICKS_QUERY_CONCURRENCY` adjusts this from 1–16.
- Each query has a 120-second client deadline with cancellation. Adjust `DATABRICKS_QUERY_TIMEOUT_SECONDS` from 1–600. Configure the warehouse's statement timeout separately if required.
- Analytics reads are limited to 100,000 rows per underlying query and fail explicitly above that threshold; they never silently truncate KPIs. Narrow filters or increase `DATABRICKS_MAX_ROWS` (maximum 1,000,000) if memory permits. Existing tab calculations remain in TypeScript; counts, min/max/sum queries and channel-group spend aggregation execute in SQL. Large production workloads may need further SQL aggregation and performance tuning.
- CSV downloads use ordered pages of up to 5,000 rows and stream all rows, independently of the analytics limit. Exports are read-only but use separate paged queries; run against a stable publication if source tables are changing during a download. A later-page warehouse failure interrupts the download; retry it after recovery.
- Table counts, schema metadata and successful readiness checks cache for 60 seconds. A connected warehouse indicator proves connectivity and schema access, not upstream pipeline freshness.
- Source `data_mode`, synthetic flags and modeled-value notes remain part of the business data. Connecting a warehouse does not turn synthetic/modelled source measures into audited revenue.

## Build a deployment archive

From the complete workspace, after successful checks:

```sh
npm run package:databricks
```

This produces `dist/myhonda-databricks-app.zip`. It includes the app source, npm lockfile, deployment configuration, schema contract and this guide. It excludes `.env`, tokens, test tooling/fixtures, sample CSVs, SQLite files, Z.ai artifacts, node_modules and platform-specific build output. Dependencies install in Databricks; the archive is not a prebuilt Windows binary.

Sample data remains in `sample-data/` in the complete workspace for reproducible testing and reference. It is never read by the production application and is not served publicly. The complete workspace is needed to run the fixture tests and regenerate the archive; the smaller deployment ZIP is intended for Databricks execution.

References: [Databricks Apps runtime](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/system-env), [app.yaml configuration](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-runtime), [app authorization](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth), [SQL warehouse resources](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/sql-warehouse), [Node.js SQL driver](https://docs.databricks.com/aws/en/dev-tools/nodejs-sql-driver).
