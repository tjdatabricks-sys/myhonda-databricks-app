-- Run as a catalog/schema owner or an administrator with grant privileges.
-- Replace the three values below. Quote catalog/schema identifiers with backticks.
-- The app service principal ID is shown on the app's Authorization tab.
GRANT USE CATALOG ON CATALOG `<catalog>` TO `<app-service-principal-id>`;
GRANT USE SCHEMA ON SCHEMA `<catalog>`.`<schema>` TO `<app-service-principal-id>`;
GRANT SELECT ON SCHEMA `<catalog>`.`<schema>` TO `<app-service-principal-id>`;
-- Scope SELECT to individual required tables instead if the schema contains
-- additional data the app must not access. Required tables: data/gold-business-schema.csv.
-- In the app UI, also bind the SQL warehouse as resource key sql-warehouse
-- with Can use permission. Warehouse permission is separate from these grants.
