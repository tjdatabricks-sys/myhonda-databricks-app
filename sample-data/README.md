# myhonda gold_business — Sample Data Package

Sample row-level data for every **gold_business table** powering the
**myhonda Marketing IQ** analytics app (Gold Layer Analytics explorer).

- **Source of truth for structure**: `schema/gold-to-gold-business.csv` — the exact file you supplied
  (`07_gold_to_gold_business.csv`, catalog `media-poc`, schema `gold_business` — 39 tables / 468 columns,
  `catalog_name,schema_name,table_name,column_name,data_type,ordinal_position`).
- **Data**: generated sample rows that conform 1:1 to that schema — every CSV header matches the schema's
  column names and order for its table. Replace these files with your real gold_business extracts and the
  app works unchanged — it reads the same columns.
- **Scale**: 39 materialized tables · 26,854 sample rows.

## Contents

```
myhonda-gold-business-sample-data/
├── README.md                        <- this file
├── manifest.json                    <- machine-readable inventory (tables, rows, columns, files)
├── schema/
│   └── gold-to-gold-business.csv    <- YOUR original schema file (source of truth)
└── data/                            <- one CSV per gold_business table (columns = schema order)
    ├── dim_*.csv                      conformed dimensions
    ├── mart_*.csv                     consumption marts (pre-aggregated for the use cases)
    └── ref_*.csv                      reference data
```

## Table inventory (row counts = sample rows in this package)

### Conformed dimensions (19)
| Table | Rows | Grain |
|---|---:|---|
| dim_branch | 36 | branch_code |
| dim_campaign | 45 | campaign_key |
| dim_customer | 6,000 | customer_id |
| dim_customer_segment | 7 | segment_id |
| dim_date | 547 | calendar_date |
| dim_demo_customer | 200 | customer_id |
| dim_demo_experiment_variant | 32 | experiment_id, variant_id |
| dim_ecom_product | 30 | sku |
| dim_email_campaign | 108 | mapping_source_system, campaignid |
| dim_market | 12 | market_id |
| dim_paid_ad | ~300 | source_campaign_id, ad_id |
| dim_paid_source_campaign | 45 | mapping_source_system, campaign_match_token |
| dim_product | 10 | product_id |
| dim_programmatic_creative | ~90 | mapping_source_system, creative_asset_id |
| dim_region | 5 | region_id |
| dim_social_campaign | 320 | mapping_source_system, post_campaign_ref |
| dim_vendor_campaign | ~30 | mapping_source_system, source_table, source_campaign_id |
| dim_web_experiment_variant | 32 | test_key, variant_id |
| dim_zip_geography | 120 | zip_code |

### Consumption marts (17)
| Table | Rows | Grain |
|---|---:|---|
| mart_banking_funded_accounts_monthly | ~1,000 | opening_month, product_id, market_id |
| mart_brand_survey_wave | 72 | survey_wave_id |
| mart_campaign_attribution_coverage | ~290 | report_month, platform, campaign_resolution_status |
| mart_demo_experiment_variant | 32 | experiment_id, variant_id |
| mart_demo_finance_reconciliation_monthly | 72 | spend_month, currency, reconciliation_status |
| mart_demo_paid_media_daily | 2,875 | campaign_key, report_date, platform, format |
| mart_demo_paid_reach_window | 90 | ad_id, window_type, reach_scope |
| mart_demo_relationship_value_monthly | 324 | campaign_key, value_month, product_id, market_id |
| mart_demo_submission_funnel | 187 | campaign_key, submission_month, platform, format |
| mart_direct_mail_performance_monthly | 144 | mail_month, mapping_source_campaign_id, addr_market |
| mart_ecom_orders_monthly | 108 | order_month, order_status |
| mart_email_engagement_daily | 108 | cmpgn_id, send_dt |
| mart_new_funded_customers_monthly | 705 | acquisition_month, product_id, market_id, segment_id |
| mart_offline_activity_monthly | 345 | observation_month, source_channel, campaign, metric |
| mart_sales_target_attainment_monthly | 984 | target_month, product_id, market_id, plan_version |
| mart_vendor_media_daily | 680 | source_table, report_date, source_campaign_id |
| mart_website_engagement_daily | 10,947 | session_date, landing_page_path, device_category |

### Reference (3)
| Table | Rows | Grain |
|---|---:|---|
| ref_fx_rate | 108 | rate_date, base_ccy, quote_ccy |
| ref_sales_target_override_candidate | 40 | target_month, product_id, market_id, plan_version |
| ref_source_acceptance_check | 25 | check_id |

## How this data maps to the app (use cases → tables)

| App tab | Use case | Primary gold_business tables |
|---|---|---|
| Control Tower | Executive overview | mart_demo_paid_media_daily, mart_demo_submission_funnel, mart_demo_relationship_value_monthly, mart_sales_target_attainment_monthly |
| Campaign Performance | UC01 | dim_campaign, mart_demo_paid_media_daily, mart_demo_submission_funnel, mart_demo_relationship_value_monthly |
| Paid Media | UC02 | mart_demo_paid_media_daily, mart_demo_paid_reach_window, dim_paid_ad, mart_vendor_media_daily |
| Acquisition Funnel | UC01 | mart_demo_submission_funnel |
| Digital Engagement | UC03 | mart_website_engagement_daily, mart_email_engagement_daily, dim_email_campaign, dim_social_campaign |
| Experiments | UC04 | mart_demo_experiment_variant, dim_web_experiment_variant, dim_demo_experiment_variant |
| Omnichannel & Offline | UC05 | mart_offline_activity_monthly, mart_direct_mail_performance_monthly, dim_branch, dim_vendor_campaign |
| Customer Acquisition | UC06 | mart_new_funded_customers_monthly, dim_customer, dim_customer_segment, dim_zip_geography |
| Revenue & Contribution | UC07 | mart_demo_relationship_value_monthly, mart_banking_funded_accounts_monthly, dim_product |
| Finance Reconciliation | UC08 | mart_demo_finance_reconciliation_monthly, mart_vendor_media_daily, dim_vendor_campaign |
| Targets & Attainment | UC09 | mart_sales_target_attainment_monthly, ref_sales_target_override_candidate |
| Brand Lift | UC10 | mart_brand_survey_wave |
| E-Commerce | Supplemental | mart_ecom_orders_monthly, dim_ecom_product |
| Schema Explorer | Platform | schema registry (gold-to-gold-business.csv) + live table counts |
| Governance & Quality | Platform | resolution dims (dim_email_campaign, dim_paid_ad, dim_paid_source_campaign, dim_programmatic_creative, dim_social_campaign, dim_vendor_campaign, dim_web_experiment_variant), mart_campaign_attribution_coverage, ref_source_acceptance_check, ref_fx_rate |

## Conventions

- **Dates**: `YYYY-MM-DD` (DATE columns); full ISO-8601 UTC for timestamps.
- **Booleans**: `true` / `false`. **Nulls**: empty field.
- **Money**: USD decimals (`spend_usd`, `postage_usd`, `net_interest_income_usd`, ...).
- **Rates**: decimals (`link_click_rate` 0.0478 = 4.78%; brand `*_pct` columns are decimals 0–1).
- `mart_demo_submission_funnel` carries sentinel rows with `campaign_key = "UNATTRIBUTED"`
  (cross-channel volume kept for coverage measurement); `mart_website_engagement_daily` keeps
  unattributed rows with NULL `resolved_campaign_key`.
- Resolution columns (`resolved_campaign_key`, `proposed_campaign_key`, `campaign_resolution_status`)
  follow the campaign identity-resolution convention: `Resolved` / `Pending` / `Proposed` / `Unresolved`.
- `data_mode = SYNTHETIC` and `pack_version = v2.1.0` fields are carried through from the gold schema.

## Using these fixtures

These generated CSVs are test fixtures. Run `npm test` from the repository root to load them into the test-only relational engine and verify API calculations, filters and exports. `manifest.json` records the generated row counts.

The production app reads Databricks SQL directly. It does not import these CSVs or use Prisma. To connect production data, select the warehouse resource, set the catalog and schema in `app.yaml`, and grant the app service principal access to tables matching `data/gold-business-schema.csv`. See the repository README for deployment instructions.

These fixture files are excluded from the generated deployment ZIP and are not served from the public web directory.
