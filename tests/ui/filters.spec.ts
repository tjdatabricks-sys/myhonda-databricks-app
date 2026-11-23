import {test, expect, type Page} from '@playwright/test';
import fs from 'node:fs';

const generated = JSON.parse(fs.readFileSync('tests/generated/filter-scenarios.json','utf8'));
const standard = JSON.parse(fs.readFileSync('tests/generated/api-responses.json','utf8'));
const dimensions: Record<string,string> = generated.dimensions;
const key = (params:Record<string,string>) => JSON.stringify(Object.entries(params).sort(([a],[b]) => a.localeCompare(b)));
const result = (endpoint:string, params:Record<string,string> = {}) => generated.scenarios[endpoint][key(params)];
const compactMoney = (value:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(value);
const count = (value:number) => new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value);
const reports = [
  ['overview','Control Tower',['Segment']], ['campaigns','Campaign Performance',['Segment']],
  ['paid-media','Paid Media',['Segment']], ['funnel','Acquisition Funnel',['Market','Segment']],
  ['digital','Digital Engagement',['Market','Segment']], ['omnichannel','Omnichannel & Offline',['Segment']],
  ['customers','Customer Acquisition',[]], ['contribution','Revenue & Contribution',[]],
  ['finance','Finance Reconciliation',['Market','Segment']], ['targets','Targets & Attainment',['Segment']],
  ['brand','Brand Lift',['Segment']], ['experiments','Experiments',['Market','Segment']],
  ['ecom','E-Commerce',['Campaign','Platform','Market','Product','Segment']],
] as const;
const selections: Record<string,{label:string;name:string}> = {
  platform:{label:'Platform',name:'Meta'},
  campaign:{label:'Campaign',name:generated.filterOptions.campaigns.find((row:{campaignKey:string}) => row.campaignKey===dimensions.campaign).campaignTitle},
  market:{label:'Market',name:generated.filterOptions.markets.find((row:{marketId:string}) => row.marketId===dimensions.market).marketDisplayName},
  product:{label:'Product',name:generated.filterOptions.products.find((row:{productId:string}) => row.productId===dimensions.product).productName},
  segment:{label:'Segment',name:generated.filterOptions.segments.find((row:{segmentId:string}) => row.segmentId===dimensions.segment).segment},
};
async function select(page:Page,label:string,name:string) {
  await page.getByRole('combobox',{name:label,exact:true}).click();
  await page.getByRole('option',{name,exact:true}).click();
}
async function allTime(page:Page) {
  await select(page,'Date range','All time');
}
test.beforeEach(async ({page}) => {
  await page.route('**/api/**',route => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop()!;
    const params = Object.fromEntries([...url.searchParams].filter(([name]) => ['campaign','platform','market','product','segment'].includes(name)));
    const body = endpoint==='filters' ? generated.filterOptions : generated.scenarios[endpoint]?.[key(params)] ?? standard[endpoint];
    return route.fulfill({status:200,json:body ?? {}});
  });
});

test('platform dropdown offers every discovered family including platforms outside paid media',async ({page}) => {
  await page.goto('/');
  await page.getByRole('combobox',{name:'Platform',exact:true}).click();
  await expect(page.getByRole('option')).toHaveCount(generated.filterOptions.platforms.length+1);
  for (const platform of generated.filterOptions.platforms) await expect(page.getByRole('option',{name:platform,exact:true})).toHaveCount(1);
  await page.getByRole('option',{name:'Google Ads',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Platform',exact:true})).toContainText('Google Ads');
});

test('platform selection changes visible spend and Clear restores the original KPI',async ({page}) => {
  await page.goto('/'); await allTime(page);
  await page.getByRole('button',{name:'Paid Media',exact:true}).click();
  const spend = page.getByRole('group',{name:'Spend KPI',exact:true});
  await expect(spend).toContainText(compactMoney(result('paid-media').kpis.spend));
  await select(page,'Platform','Meta');
  await expect(spend).toContainText(compactMoney(result('paid-media',{platform:'Meta'}).kpis.spend));
  expect(result('paid-media',{platform:'Meta'}).kpis.spend).not.toBe(result('paid-media').kpis.spend);
  await page.getByRole('button',{name:/Clear \(/}).click();
  await expect(spend).toContainText(compactMoney(result('paid-media').kpis.spend));
  await expect(page.getByRole('combobox',{name:'Platform',exact:true})).toContainText('All platforms');
});

test('delivery chart renders non-flat data after filtering and clearing',async ({page}) => {
  await page.goto('/'); await allTime(page);
  await page.getByRole('button',{name:'Paid Media',exact:true}).click();
  const chart = page.locator('.recharts-area-area').first();
  const expectPlot = async () => {
    await expect(chart).toBeVisible();
    await expect.poll(() => chart.evaluate(element => (element as SVGGraphicsElement).getBBox().height)).toBeGreaterThan(1);
  };
  await expectPlot();
  await select(page,'Platform','Meta');
  await expect(page.getByRole('group',{name:'Spend KPI',exact:true})).toContainText(compactMoney(result('paid-media',{platform:'Meta'}).kpis.spend));
  await expectPlot();
  await page.getByRole('button',{name:/Clear \(/}).click();
  await expect(page.getByRole('group',{name:'Spend KPI',exact:true})).toContainText(compactMoney(result('paid-media').kpis.spend));
  await expectPlot();
});

test('rapid platform changes and a late response cannot overwrite the current selection or Clear',async ({page}) => {
  await page.route('**/api/paid-media?**',async route => {
    const platform = new URL(route.request().url()).searchParams.get('platform');
    if (platform==='Meta') await new Promise(resolve => setTimeout(resolve,600));
    return route.fulfill({status:200,json:result('paid-media',platform ? {platform} : {})});
  });
  await page.goto('/'); await allTime(page);
  await page.getByRole('button',{name:'Paid Media',exact:true}).click();
  await select(page,'Platform','Meta');
  await select(page,'Platform','Google Ads');
  const spend = page.getByRole('group',{name:'Spend KPI',exact:true});
  await expect(spend).toContainText(compactMoney(result('paid-media',{platform:'Google Ads'}).kpis.spend));
  await expect(page.getByRole('combobox',{name:'Platform',exact:true})).toContainText('Google Ads');
  await page.getByRole('button',{name:/Clear \(/}).click();
  await expect(spend).toContainText(compactMoney(result('paid-media').kpis.spend));
  await select(page,'Platform','Meta');
  await expect(spend).toContainText(compactMoney(result('paid-media',{platform:'Meta'}).kpis.spend));
});

for (const dimension of ['market','product','segment'] as const) {
  test(`${dimension} selection changes the acquisition KPI and clears correctly`,async ({page}) => {
    await page.goto('/'); await allTime(page);
    await page.getByRole('button',{name:'Customer Acquisition',exact:true}).click();
    const kpi = page.getByRole('group',{name:'New Funded Customers KPI',exact:true});
    await expect(kpi).toContainText(count(result('customers').kpis.newCustomers));
    await select(page,selections[dimension].label,selections[dimension].name);
    await expect(kpi).toContainText(count(result('customers',{[dimension]:dimensions[dimension]}).kpis.newCustomers));
    expect(result('customers',{[dimension]:dimensions[dimension]}).kpis.newCustomers).not.toBe(result('customers').kpis.newCustomers);
    await page.getByRole('button',{name:/Clear \(/}).click();
    await expect(kpi).toContainText(count(result('customers').kpis.newCustomers));
  });
}

test('all report controls match supported dimensions and selections survive navigation',async ({page}) => {
  const requests: URL[] = [];
  page.on('request',request => {if(request.url().includes('/api/')) requests.push(new URL(request.url()));});
  await page.goto('/'); await allTime(page);
  await page.getByRole('button',{name:'Customer Acquisition',exact:true}).click();
  for (const selection of Object.values(selections)) await select(page,selection.label,selection.name);
  await expect(page.getByRole('group',{name:'New Funded Customers KPI',exact:true})).toContainText(count(result('customers',dimensions).kpis.newCustomers));
  for (const [endpoint,label,disabled] of reports) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await expect(page.getByRole('heading',{name:label,exact:true})).toBeVisible();
    for (const selection of Object.values(selections)) {
      const control = page.getByRole('combobox',{name:selection.label,exact:true});
      if ((disabled as readonly string[]).includes(selection.label)) await expect(control).toBeDisabled();
      else { await expect(control).toBeEnabled(); await expect(control).toContainText(selection.name); }
    }
    await expect(page.getByTestId('filter-scope')).toBeVisible();
    await expect.poll(() => requests.filter(url => url.pathname===`/api/${endpoint}`).length).toBeGreaterThan(0);
    const url = requests.filter(url => url.pathname===`/api/${endpoint}`).at(-1)!;
    for (const [name,value] of Object.entries(dimensions)) {
      if ((disabled as readonly string[]).includes(selections[name].label)) expect(url.searchParams.has(name)).toBe(false);
      else expect(url.searchParams.get(name)).toBe(value);
    }
  }
  await page.getByRole('button',{name:'Customer Acquisition',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Segment',exact:true})).toContainText(selections.segment.name);
  await page.screenshot({path:'tests/generated/filters-desktop.png',fullPage:true});
});

test('mobile filters preserve selection, support scrolling options and clear in one action',async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/'); await allTime(page);
  await select(page,'Platform','The Trade Desk');
  await expect(page.getByRole('combobox',{name:'Platform',exact:true})).toContainText('The Trade Desk');
  await page.getByRole('button',{name:'Open navigation'}).click();
  await page.getByRole('button',{name:'Paid Media',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Platform',exact:true})).toContainText('The Trade Desk');
  await page.getByRole('button',{name:/Clear \(/}).click();
  await expect(page.getByRole('combobox',{name:'Platform',exact:true})).toContainText('All platforms');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:'tests/generated/filters-mobile.png',fullPage:true});
});
