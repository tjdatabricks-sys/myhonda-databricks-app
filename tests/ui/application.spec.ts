import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const fixtures = JSON.parse(fs.readFileSync('tests/generated/api-responses.json', 'utf8'));
const labels = ['Control Tower','Campaign Performance','Paid Media','Acquisition Funnel','Digital Engagement','Omnichannel & Offline','Customer Acquisition','Revenue & Contribution','Finance Reconciliation','Targets & Attainment','Experiments','Brand Lift','E-Commerce','Schema Explorer','Governance & Quality'];

test('the real deployment probe responds without a warehouse connection', async ({request}) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  expect((await response.json()).status).toBe('alive');
});

test.beforeEach(async ({page}) => {
  await page.route('**/api/**',async route => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop()!;
    await route.fulfill({status:200,json:fixtures[endpoint] ?? {}});
  });
});

test('table CSV download links point to the warehouse export endpoint',async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Schema Explorer',exact:true}).click();
  const link = page.getByRole('link',{name:'Download dim_campaign CSV',exact:true});
  await expect(link).toHaveAttribute('href','/api/export?table=dim_campaign');
  await expect(link).toHaveAttribute('download','');
});

test('all 15 tabs render with live-shaped responses and no browser errors', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror',error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Warehouse connected',{exact:true})).toBeVisible();
  for (const label of labels) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await expect(page.getByRole('heading',{name:label,exact:true})).toBeVisible();
    await expect(page.locator('main')).not.toContainText('NaN');
    for (const removed of ['Blended CAC','Blended ROI','Avg CAC','Observed ROI']) await expect(page.getByText(removed,{exact:true})).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  await page.screenshot({path:'tests/generated/desktop.png',fullPage:true});
});

test('aggregate CAC and ROI cards are removed and the remaining KPI grids stay complete',async ({page}) => {
  await page.goto('/');
  for (const [label,cards] of [['Control Tower',5],['Campaign Performance',4],['Customer Acquisition',5],['Revenue & Contribution',5]] as const) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await expect(page.getByRole('group',{name:/ KPI$/})).toHaveCount(cards);
    for (const removed of ['Blended CAC','Blended ROI','Avg CAC','Observed ROI']) await expect(page.getByText(removed,{exact:true})).toHaveCount(0);
  }
  await page.getByRole('button',{name:'Campaign Performance',exact:true}).click();
  await expect(page.getByRole('columnheader',{name:'ROI',exact:true}).first()).toBeVisible();
  await expect(page.getByRole('columnheader',{name:'CAC',exact:true}).first()).toBeVisible();
});

test('date filters use fixture dates and mobile navigation opens a report',async ({page}) => {
  await page.goto('/');
  await page.getByRole('combobox').first().click();
  const end = fixtures.filters.dateRange.max;
  const start = new Date(end + 'T00:00:00Z');
  start.setUTCDate(start.getUTCDate() - 29);
  const requested = page.waitForRequest(request => request.url().includes('/api/overview?') && request.url().includes('from=' + start.toISOString().slice(0,10)));
  await page.getByRole('option',{name:'Last 30 days',exact:true}).click();
  expect((await requested).url()).toContain('to=' + end);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Open navigation'}).click();
  await page.getByRole('button',{name:'Finance Reconciliation',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Finance Reconciliation',exact:true})).toBeVisible();
  await page.screenshot({path:'tests/generated/mobile.png',fullPage:true});
});

test('warehouse errors are visible to the user',async ({page}) => {
  await page.route('**/api/ready',route => route.fulfill({status:503,json:{error:'Check SQL warehouse and SELECT grants.'}}));
  await page.goto('/');
  await expect(page.getByText('Warehouse needs attention',{exact:true})).toBeVisible();
  await expect(page.getByText('Check SQL warehouse and SELECT grants.',{exact:true})).toBeVisible();
});
