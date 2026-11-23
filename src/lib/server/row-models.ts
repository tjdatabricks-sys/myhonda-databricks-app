// Generated from the supplied gold schema. No ORM runtime is required.
export interface RowModels {
  Branch: {
    branchCode: string;
    branchName: string;
    marketCode: string;
    marketName: string;
    stateCode: string;
    branchType: string;
    openStatus: string;
    latitude: number;
    longitude: number;
    regionId: string;
    isSynthetic: boolean;
  };
  Campaign: {
    campaignKey: string;
    campaignTitle: string;
    initiativeType: string;
    productCd: string;
    marketScope: string;
    planCurrency: string;
    startDt: Date;
    endDt: Date;
    approvalStatus: string;
    businessOwner: string;
    campaignNotes: string | null;
    productId: string;
    productCategory: string;
    estimatedValueUsd: number;
    plannedBudgetNew: number;
    campaignName: string;
    campaignStartDate: Date;
    campaignEndDate: Date;
  };
  Customer: {
    partyId: string;
    relationshipStatus: string;
    relationshipTenureMonths: number;
    valueSegment: string;
    homeMarketCd: string;
    homeBranchCd: string;
    digitalBankingFlag: boolean;
    emailMarketingPermission: boolean;
    smsMarketingPermission: boolean;
    directMailEligible: boolean;
    contactPreference: string;
    customerSince: Date;
    recordCreatedTs: Date;
    customerId: string;
    segment: string;
    segmentId: string;
    zipCode: number;
    marketId: string;
    regionId: string;
    isSynthetic: boolean;
  };
  CustomerSegment: {
    segmentId: string;
    segment: string;
    segmentGroup: string;
    segmentDescription: string;
    suggestedMessageTheme: string;
    isSynthetic: boolean;
    recordOrigin: string;
  };
  DateDim: {
    calendarDate: Date;
    calendarYear: number;
    calendarQuarter: number;
    monthStart: Date;
    weekStart: Date;
    isWeekend: boolean;
    holidayName: string | null;
    isBankHoliday: boolean;
  };
  DemoCustomer: {
    customerId: string;
    homeMarketId: string;
    createdAt: Date;
    dataMode: string;
    packVersion: string;
  };
  ExperimentVariantDim: {
    experimentId: string;
    campaignKey: string;
    variantId: string;
    allocationFraction: number;
    primaryEvent: string;
    windowStart: Date;
    windowEnd: Date;
    dataMode: string;
    packVersion: string;
  };
  EcomProduct: {
    sku: string;
    productName: string;
    category: string;
    brand: string;
    listPriceUsd: number;
    unitCostUsd: number;
    isActive: boolean;
    effectiveDate: Date;
  };
  EmailCampaign: {
    mappingSourceSystem: string;
    campaignMatchToken: string;
    campaignid: string;
    campaignlabel: string;
    subjectLine: string;
    sendDate: Date;
    audienceCount: number;
    productLine: string;
    segmentFilter: string;
    fromName: string;
    journeyStatus: string;
    unsubscribeHandling: string;
    productId: string;
    productCategory: string;
    estimatedValueUsd: number;
    mappingSourceCampaignId: string;
    resolvedCampaignKey: string | null;
    proposedCampaignKey: string | null;
    campaignResolutionStatus: string;
  };
  Market: {
    marketId: string;
    marketDisplayName: string;
    stateAbbr: string;
    salesRegion: string;
    marketTier: string;
    recordOrigin: string;
    regionId: string;
    primaryCity: string;
    isSynthetic: boolean;
  };
  PaidAd: {
    sourceCampaignId: string;
    adId: string;
    creativeId: string;
    creativeVersion: number;
    format: string;
    assetFamily: string;
    destinationType: string;
    formId: string;
    marketId: string;
    effectiveStart: Date;
    effectiveEnd: Date;
    dataMode: string;
    packVersion: string;
    platform: string;
    campaignKey: string;
    resolvedCampaignKey: string | null;
    campaignResolutionStatus: string;
  };
  PaidSourceCampaign: {
    mappingSourceSystem: string;
    campaignMatchToken: string;
    sourceCampaignId: string;
    campaignKey: string;
    platform: string;
    productId: string;
    objective: string;
    flightStart: Date;
    flightEnd: Date;
    plannedBudgetUsd: number;
    currency: string;
    dataMode: string;
    packVersion: string;
    mappingSourceCampaignId: string;
    resolvedCampaignKey: string | null;
    proposedCampaignKey: string | null;
    campaignResolutionStatus: string;
  };
  Product: {
    productId: string;
    productName: string;
    productFamily: string;
    productType: string;
    primarySuccessEvent: string;
    unitEconomicsNote: string;
    productCd: string;
    prodNm: string;
    isActive: boolean;
    effectiveDate: Date;
    productCategory: string;
    estimatedValueUsd: number;
    estimatedValueCurrency: string;
    estimatedValuePeriodMonths: number;
    estimatedValueBasis: string;
    isSynthetic: boolean;
  };
  ProgrammaticCreative: {
    mappingSourceSystem: string;
    campaignMatchToken: string;
    creativeAssetId: string;
    dspCampaignId: string;
    assetName: string;
    adFormat: string;
    assetDimensions: string;
    creativeVersion: string;
    destinationUrl: string;
    legalApprovalStatus: string;
    effectiveStart: Date;
    effectiveEnd: Date;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    mappingSourceCampaignId: string;
    resolvedCampaignKey: string | null;
    proposedCampaignKey: string | null;
    campaignResolutionStatus: string;
  };
  Region: {
    regionId: string;
    regionName: string;
    regionDescription: string;
    isSynthetic: boolean;
    recordOrigin: string;
  };
  SocialCampaign: {
    mappingSourceSystem: string;
    campaignMatchToken: string;
    postCampaignRef: string;
    contentTheme: string;
    ownedHandle: string;
    platform: string;
    postType: string;
    publishDt: Date;
    campaignGoal: string;
    legalCopyStatus: string;
    mappingSourceCampaignId: string;
    resolvedCampaignKey: string | null;
    proposedCampaignKey: string | null;
    campaignResolutionStatus: string;
  };
  VendorCampaign: {
    mappingSourceSystem: string;
    campaignMatchToken: string;
    sourceRecordJson: string;
    sourceTable: string;
    platform: string;
    nativeCampaignIdentifier: string;
    sourceCampaignId: string;
    sourceCampaignName: string;
    flightStart: Date;
    flightEnd: Date;
    campaignStatus: string;
    budgetAmount: number;
    currency: string;
    budgetPeriod: string;
    mappingSourceCampaignId: string;
    resolvedCampaignKey: string | null;
    proposedCampaignKey: string | null;
    campaignResolutionStatus: string;
  };
  WebExperimentVariant: {
    mappingSourceSystem: string;
    campaignMatchToken: string;
    testKey: string;
    experimentName: string;
    cmpgnRef: string;
    hypothesisText: string;
    primaryMetric: string;
    variant: string;
    allocationPct: number;
    beginDate: Date;
    endDate: Date;
    status: string;
    ownerTeam: string;
    variantId: string;
    mappingSourceCampaignId: string;
    resolvedCampaignKey: string | null;
    proposedCampaignKey: string | null;
    campaignResolutionStatus: string;
  };
  ZipGeography: {
    zipCode: number;
    city: string;
    stateAbbr: string;
    marketId: string;
    marketName: string;
    regionId: string;
    region: string;
    marketTier: string;
    zip3: number;
    isSynthetic: boolean;
    recordOrigin: string;
    geographyNote: string | null;
  };
  BankingFundedAccountsMonthly: {
    openingMonth: Date;
    productId: string;
    marketId: string;
    openedAccounts: number;
    fundedAccounts: number;
  };
  BrandSurveyWave: {
    surveyWaveId: string;
    surveyDate: Date;
    marketCode: string;
    campaignRef: string;
    resolvedCampaignKey: string | null;
    campaignResolutionStatus: string;
    measurementWave: string;
    sampleSize: number;
    brandAwarenessPct: number;
    considerationPct: number;
    messageRecallPct: number;
    collectionMethod: string;
    sourceNote: string | null;
  };
  CampaignAttributionCoverage: {
    reportMonth: Date;
    platform: string;
    currency: string;
    campaignResolutionStatus: string;
    sourceRowCount: number;
    distinctSourceCampaigns: number;
    spendAmount: number;
  };
  ExperimentVariantMart: {
    campaignKey: string;
    experimentId: string;
    variantId: string;
    allocationFraction: number;
    primaryEvent: string;
    windowStart: Date;
    windowEnd: Date;
    dataMode: string;
    packVersion: string;
    eligibleUnits: number;
    convertedUnits: number;
    primaryEventRate: number;
    campaignName: string;
  };
  FinanceReconciliationMonthly: {
    spendMonth: Date;
    currency: string;
    reconciliationStatus: string;
    financeLinks: number;
    invoiceNetUsd: number;
    glNetUsd: number;
    invoiceMinusGlUsd: number;
  };
  PaidMediaDaily: {
    campaignKey: string;
    reportDate: Date;
    sourceCampaignId: string;
    platform: string;
    format: string;
    currency: string;
    packVersion: string;
    activeAds: number;
    impressions: number;
    linkClicks: number;
    responseStarts: number;
    reportedResponseSubmissions: number;
    spendUsd: number;
    linkClickRate: number;
    campaignName: string;
  };
  PaidReachWindow: {
    campaignKey: string;
    reachScope: string;
    platform: string;
    sourceCampaignId: string;
    format: string;
    adId: string;
    windowType: string;
    windowStart: Date;
    windowEnd: Date;
    uniqueReach: number;
    impressions: number;
    reachMethod: string;
    dataMode: string;
    packVersion: string;
    campaignName: string;
  };
  RelationshipValueMonthly: {
    campaignKey: string;
    valueMonth: Date;
    productId: string;
    marketId: string;
    valueStatus: string;
    packVersion: string;
    observedAccounts: number;
    netInterestIncomeUsd: number;
    netRelationshipContributionUsd: number;
    campaignName: string;
  };
  SubmissionFunnelMart: {
    campaignKey: string;
    submissionMonth: Date;
    sourceCampaignId: string;
    platform: string;
    format: string;
    packVersion: string;
    submissions: number;
    duplicateSubmissions: number;
    eligibleSubmissions: number;
    submissionsWithoutCrmMatch: number;
    submissionsWithLeads: number;
    submissionsWithQualifiedLeads: number;
    submissionsWithApplications: number;
    submissionsWithApprovedApplications: number;
    submissionsWithOpenedAccounts: number;
    submissionsWithFundedAccounts: number;
    leadRate: number;
    applicationRate: number;
    fundedAccountRate: number;
    campaignName: string;
  };
  DirectMailPerformanceMonthly: {
    mailMonth: Date;
    mappingSourceCampaignId: string;
    resolvedCampaignKey: string | null;
    campaignResolutionStatus: string;
    addrMarket: string;
    mailJobs: number;
    deliveredJobs: number;
    deliveredJobsWithResponse: number;
    deliveredJobsWithQrScan: number;
    linkedResponseEvents: number;
    postageUsd: number;
    deliveredJobResponseRate: number;
    deliveredJobQrScanRate: number;
  };
  EcomOrdersMonthly: {
    orderMonth: Date;
    currency: string;
    orderStatus: string;
    orders: number;
    orderTotalAmount: number;
    orderTaxAmount: number;
    orderShippingAmount: number;
  };
  EmailEngagementDaily: {
    cmpgnId: string;
    sendDt: Date;
    resolvedCampaignKey: string | null;
    campaignResolutionStatus: string;
    sent: number;
    delivered: number;
    uniqueOpens: number;
    uniqueClicks: number;
    hardSoftBounces: number;
    optOuts: number;
    deliveryRate: number;
    bounceRate: number;
    emailClickRate: number;
    optOutRate: number;
  };
  NewFundedCustomersMonthly: {
    acquisitionMonth: Date;
    productId: string;
    marketId: string;
    segmentId: string;
    resolvedCampaignKey: string | null;
    campaignResolutionStatus: string;
    newFundedCustomers: number;
  };
  OfflineActivityMonthly: {
    observationMonth: Date;
    sourceChannel: string;
    mappingSourceCampaignId: string;
    resolvedCampaignKey: string | null;
    campaignResolutionStatus: string;
    geographySourceValue: string;
    metric: string;
    metricValue: number;
  };
  SalesTargetAttainmentMonthly: {
    targetMonth: Date;
    productId: string;
    marketId: string;
    targetFundedAccounts: number;
    targetContributionUsd: number;
    planVersion: string;
    openedAccounts: number;
    fundedAccounts: number;
    fundedAccountGap: number;
    fundedAccountAttainment: number;
  };
  VendorMediaDaily: {
    resolvedCampaignKey: string | null;
    sourceTable: string;
    platform: string;
    reportDate: Date;
    reportEndDate: Date;
    sourceCampaignId: string;
    campaignResolutionStatus: string;
    currency: string;
    clickEvent: string;
    conversionEvent: string;
    conversionValueEvent: string;
    sourceRowCount: number;
    reportedImpressions: number;
    reportedClicks: number;
    spendAmount: number;
    reportedConversions: number;
    reportedConversionValue: number;
    reportedClickRate: number;
    costPerReportedClick: number;
    costPerThousandImpressions: number;
    campaignName: string;
  };
  WebsiteEngagementDaily: {
    sessionDate: Date;
    landingPagePath: string;
    deviceCategory: string;
    mappingSourceCampaignId: string | null;
    resolvedCampaignKey: string | null;
    campaignResolutionStatus: string;
    sessions: number;
    sessionsWithEngagementFlag: number;
    engagedSessions: number;
    sessionsWithApplicationSubmit: number;
    engagedSessionRate: number;
    webApplicationSubmitRate: number;
  };
  FxRate: {
    rateDate: Date;
    baseCcy: string;
    quoteCcy: string;
    rate: number;
  };
  SalesTargetOverrideCandidate: {
    targetMonth: Date;
    productId: string;
    marketId: string;
    planVersion: string;
    selectedFundedAccounts: number;
    selectedContributionUsd: number;
    rejectedFundedAccounts: number;
    rejectedContributionUsd: number;
    overrideStatus: string;
    reason: string | null;
    dataMode: string;
    packVersion: string;
  };
  SourceAcceptanceCheck: {
    checkId: string;
    acceptanceCriterion: string;
    observedResult: string;
    expectedResult: string;
    status: string;
  };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  "Branch": {
    "branchCode": "String",
    "branchName": "String",
    "marketCode": "String",
    "marketName": "String",
    "stateCode": "String",
    "branchType": "String",
    "openStatus": "String",
    "latitude": "Float",
    "longitude": "Float",
    "regionId": "String",
    "isSynthetic": "Boolean"
  },
  "Campaign": {
    "campaignKey": "String",
    "campaignTitle": "String",
    "initiativeType": "String",
    "productCd": "String",
    "marketScope": "String",
    "planCurrency": "String",
    "startDt": "DateTime",
    "endDt": "DateTime",
    "approvalStatus": "String",
    "businessOwner": "String",
    "campaignNotes": "String",
    "productId": "String",
    "productCategory": "String",
    "estimatedValueUsd": "Float",
    "plannedBudgetNew": "Float",
    "campaignName": "String",
    "campaignStartDate": "DateTime",
    "campaignEndDate": "DateTime"
  },
  "Customer": {
    "partyId": "String",
    "relationshipStatus": "String",
    "relationshipTenureMonths": "Int",
    "valueSegment": "String",
    "homeMarketCd": "String",
    "homeBranchCd": "String",
    "digitalBankingFlag": "Boolean",
    "emailMarketingPermission": "Boolean",
    "smsMarketingPermission": "Boolean",
    "directMailEligible": "Boolean",
    "contactPreference": "String",
    "customerSince": "DateTime",
    "recordCreatedTs": "DateTime",
    "customerId": "String",
    "segment": "String",
    "segmentId": "String",
    "zipCode": "Int",
    "marketId": "String",
    "regionId": "String",
    "isSynthetic": "Boolean"
  },
  "CustomerSegment": {
    "segmentId": "String",
    "segment": "String",
    "segmentGroup": "String",
    "segmentDescription": "String",
    "suggestedMessageTheme": "String",
    "isSynthetic": "Boolean",
    "recordOrigin": "String"
  },
  "DateDim": {
    "calendarDate": "DateTime",
    "calendarYear": "Int",
    "calendarQuarter": "Int",
    "monthStart": "DateTime",
    "weekStart": "DateTime",
    "isWeekend": "Boolean",
    "holidayName": "String",
    "isBankHoliday": "Boolean"
  },
  "DemoCustomer": {
    "customerId": "String",
    "homeMarketId": "String",
    "createdAt": "DateTime",
    "dataMode": "String",
    "packVersion": "String"
  },
  "ExperimentVariantDim": {
    "experimentId": "String",
    "campaignKey": "String",
    "variantId": "String",
    "allocationFraction": "Float",
    "primaryEvent": "String",
    "windowStart": "DateTime",
    "windowEnd": "DateTime",
    "dataMode": "String",
    "packVersion": "String"
  },
  "EcomProduct": {
    "sku": "String",
    "productName": "String",
    "category": "String",
    "brand": "String",
    "listPriceUsd": "Float",
    "unitCostUsd": "Float",
    "isActive": "Boolean",
    "effectiveDate": "DateTime"
  },
  "EmailCampaign": {
    "mappingSourceSystem": "String",
    "campaignMatchToken": "String",
    "campaignid": "String",
    "campaignlabel": "String",
    "subjectLine": "String",
    "sendDate": "DateTime",
    "audienceCount": "Int",
    "productLine": "String",
    "segmentFilter": "String",
    "fromName": "String",
    "journeyStatus": "String",
    "unsubscribeHandling": "String",
    "productId": "String",
    "productCategory": "String",
    "estimatedValueUsd": "Float",
    "mappingSourceCampaignId": "String",
    "resolvedCampaignKey": "String",
    "proposedCampaignKey": "String",
    "campaignResolutionStatus": "String"
  },
  "Market": {
    "marketId": "String",
    "marketDisplayName": "String",
    "stateAbbr": "String",
    "salesRegion": "String",
    "marketTier": "String",
    "recordOrigin": "String",
    "regionId": "String",
    "primaryCity": "String",
    "isSynthetic": "Boolean"
  },
  "PaidAd": {
    "sourceCampaignId": "String",
    "adId": "String",
    "creativeId": "String",
    "creativeVersion": "Int",
    "format": "String",
    "assetFamily": "String",
    "destinationType": "String",
    "formId": "String",
    "marketId": "String",
    "effectiveStart": "DateTime",
    "effectiveEnd": "DateTime",
    "dataMode": "String",
    "packVersion": "String",
    "platform": "String",
    "campaignKey": "String",
    "resolvedCampaignKey": "String",
    "campaignResolutionStatus": "String"
  },
  "PaidSourceCampaign": {
    "mappingSourceSystem": "String",
    "campaignMatchToken": "String",
    "sourceCampaignId": "String",
    "campaignKey": "String",
    "platform": "String",
    "productId": "String",
    "objective": "String",
    "flightStart": "DateTime",
    "flightEnd": "DateTime",
    "plannedBudgetUsd": "Float",
    "currency": "String",
    "dataMode": "String",
    "packVersion": "String",
    "mappingSourceCampaignId": "String",
    "resolvedCampaignKey": "String",
    "proposedCampaignKey": "String",
    "campaignResolutionStatus": "String"
  },
  "Product": {
    "productId": "String",
    "productName": "String",
    "productFamily": "String",
    "productType": "String",
    "primarySuccessEvent": "String",
    "unitEconomicsNote": "String",
    "productCd": "String",
    "prodNm": "String",
    "isActive": "Boolean",
    "effectiveDate": "DateTime",
    "productCategory": "String",
    "estimatedValueUsd": "Float",
    "estimatedValueCurrency": "String",
    "estimatedValuePeriodMonths": "Int",
    "estimatedValueBasis": "String",
    "isSynthetic": "Boolean"
  },
  "ProgrammaticCreative": {
    "mappingSourceSystem": "String",
    "campaignMatchToken": "String",
    "creativeAssetId": "String",
    "dspCampaignId": "String",
    "assetName": "String",
    "adFormat": "String",
    "assetDimensions": "String",
    "creativeVersion": "String",
    "destinationUrl": "String",
    "legalApprovalStatus": "String",
    "effectiveStart": "DateTime",
    "effectiveEnd": "DateTime",
    "utmSource": "String",
    "utmMedium": "String",
    "utmCampaign": "String",
    "mappingSourceCampaignId": "String",
    "resolvedCampaignKey": "String",
    "proposedCampaignKey": "String",
    "campaignResolutionStatus": "String"
  },
  "Region": {
    "regionId": "String",
    "regionName": "String",
    "regionDescription": "String",
    "isSynthetic": "Boolean",
    "recordOrigin": "String"
  },
  "SocialCampaign": {
    "mappingSourceSystem": "String",
    "campaignMatchToken": "String",
    "postCampaignRef": "String",
    "contentTheme": "String",
    "ownedHandle": "String",
    "platform": "String",
    "postType": "String",
    "publishDt": "DateTime",
    "campaignGoal": "String",
    "legalCopyStatus": "String",
    "mappingSourceCampaignId": "String",
    "resolvedCampaignKey": "String",
    "proposedCampaignKey": "String",
    "campaignResolutionStatus": "String"
  },
  "VendorCampaign": {
    "mappingSourceSystem": "String",
    "campaignMatchToken": "String",
    "sourceRecordJson": "String",
    "sourceTable": "String",
    "platform": "String",
    "nativeCampaignIdentifier": "String",
    "sourceCampaignId": "String",
    "sourceCampaignName": "String",
    "flightStart": "DateTime",
    "flightEnd": "DateTime",
    "campaignStatus": "String",
    "budgetAmount": "Float",
    "currency": "String",
    "budgetPeriod": "String",
    "mappingSourceCampaignId": "String",
    "resolvedCampaignKey": "String",
    "proposedCampaignKey": "String",
    "campaignResolutionStatus": "String"
  },
  "WebExperimentVariant": {
    "mappingSourceSystem": "String",
    "campaignMatchToken": "String",
    "testKey": "String",
    "experimentName": "String",
    "cmpgnRef": "String",
    "hypothesisText": "String",
    "primaryMetric": "String",
    "variant": "String",
    "allocationPct": "Int",
    "beginDate": "DateTime",
    "endDate": "DateTime",
    "status": "String",
    "ownerTeam": "String",
    "variantId": "String",
    "mappingSourceCampaignId": "String",
    "resolvedCampaignKey": "String",
    "proposedCampaignKey": "String",
    "campaignResolutionStatus": "String"
  },
  "ZipGeography": {
    "zipCode": "Int",
    "city": "String",
    "stateAbbr": "String",
    "marketId": "String",
    "marketName": "String",
    "regionId": "String",
    "region": "String",
    "marketTier": "String",
    "zip3": "Int",
    "isSynthetic": "Boolean",
    "recordOrigin": "String",
    "geographyNote": "String"
  },
  "BankingFundedAccountsMonthly": {
    "openingMonth": "DateTime",
    "productId": "String",
    "marketId": "String",
    "openedAccounts": "Int",
    "fundedAccounts": "Int"
  },
  "BrandSurveyWave": {
    "surveyWaveId": "String",
    "surveyDate": "DateTime",
    "marketCode": "String",
    "campaignRef": "String",
    "resolvedCampaignKey": "String",
    "campaignResolutionStatus": "String",
    "measurementWave": "String",
    "sampleSize": "Int",
    "brandAwarenessPct": "Float",
    "considerationPct": "Float",
    "messageRecallPct": "Float",
    "collectionMethod": "String",
    "sourceNote": "String"
  },
  "CampaignAttributionCoverage": {
    "reportMonth": "DateTime",
    "platform": "String",
    "currency": "String",
    "campaignResolutionStatus": "String",
    "sourceRowCount": "Int",
    "distinctSourceCampaigns": "Int",
    "spendAmount": "Float"
  },
  "ExperimentVariantMart": {
    "campaignKey": "String",
    "experimentId": "String",
    "variantId": "String",
    "allocationFraction": "Float",
    "primaryEvent": "String",
    "windowStart": "DateTime",
    "windowEnd": "DateTime",
    "dataMode": "String",
    "packVersion": "String",
    "eligibleUnits": "Int",
    "convertedUnits": "Int",
    "primaryEventRate": "Float",
    "campaignName": "String"
  },
  "FinanceReconciliationMonthly": {
    "spendMonth": "DateTime",
    "currency": "String",
    "reconciliationStatus": "String",
    "financeLinks": "Int",
    "invoiceNetUsd": "Float",
    "glNetUsd": "Float",
    "invoiceMinusGlUsd": "Float"
  },
  "PaidMediaDaily": {
    "campaignKey": "String",
    "reportDate": "DateTime",
    "sourceCampaignId": "String",
    "platform": "String",
    "format": "String",
    "currency": "String",
    "packVersion": "String",
    "activeAds": "Int",
    "impressions": "Int",
    "linkClicks": "Int",
    "responseStarts": "Int",
    "reportedResponseSubmissions": "Int",
    "spendUsd": "Float",
    "linkClickRate": "Float",
    "campaignName": "String"
  },
  "PaidReachWindow": {
    "campaignKey": "String",
    "reachScope": "String",
    "platform": "String",
    "sourceCampaignId": "String",
    "format": "String",
    "adId": "String",
    "windowType": "String",
    "windowStart": "DateTime",
    "windowEnd": "DateTime",
    "uniqueReach": "Int",
    "impressions": "Int",
    "reachMethod": "String",
    "dataMode": "String",
    "packVersion": "String",
    "campaignName": "String"
  },
  "RelationshipValueMonthly": {
    "campaignKey": "String",
    "valueMonth": "DateTime",
    "productId": "String",
    "marketId": "String",
    "valueStatus": "String",
    "packVersion": "String",
    "observedAccounts": "Int",
    "netInterestIncomeUsd": "Float",
    "netRelationshipContributionUsd": "Float",
    "campaignName": "String"
  },
  "SubmissionFunnelMart": {
    "campaignKey": "String",
    "submissionMonth": "DateTime",
    "sourceCampaignId": "String",
    "platform": "String",
    "format": "String",
    "packVersion": "String",
    "submissions": "Int",
    "duplicateSubmissions": "Int",
    "eligibleSubmissions": "Int",
    "submissionsWithoutCrmMatch": "Int",
    "submissionsWithLeads": "Int",
    "submissionsWithQualifiedLeads": "Int",
    "submissionsWithApplications": "Int",
    "submissionsWithApprovedApplications": "Int",
    "submissionsWithOpenedAccounts": "Int",
    "submissionsWithFundedAccounts": "Int",
    "leadRate": "Float",
    "applicationRate": "Float",
    "fundedAccountRate": "Float",
    "campaignName": "String"
  },
  "DirectMailPerformanceMonthly": {
    "mailMonth": "DateTime",
    "mappingSourceCampaignId": "String",
    "resolvedCampaignKey": "String",
    "campaignResolutionStatus": "String",
    "addrMarket": "String",
    "mailJobs": "Int",
    "deliveredJobs": "Int",
    "deliveredJobsWithResponse": "Int",
    "deliveredJobsWithQrScan": "Int",
    "linkedResponseEvents": "Int",
    "postageUsd": "Float",
    "deliveredJobResponseRate": "Float",
    "deliveredJobQrScanRate": "Float"
  },
  "EcomOrdersMonthly": {
    "orderMonth": "DateTime",
    "currency": "String",
    "orderStatus": "String",
    "orders": "Int",
    "orderTotalAmount": "Float",
    "orderTaxAmount": "Float",
    "orderShippingAmount": "Float"
  },
  "EmailEngagementDaily": {
    "cmpgnId": "String",
    "sendDt": "DateTime",
    "resolvedCampaignKey": "String",
    "campaignResolutionStatus": "String",
    "sent": "Int",
    "delivered": "Int",
    "uniqueOpens": "Int",
    "uniqueClicks": "Int",
    "hardSoftBounces": "Int",
    "optOuts": "Int",
    "deliveryRate": "Float",
    "bounceRate": "Float",
    "emailClickRate": "Float",
    "optOutRate": "Float"
  },
  "NewFundedCustomersMonthly": {
    "acquisitionMonth": "DateTime",
    "productId": "String",
    "marketId": "String",
    "segmentId": "String",
    "resolvedCampaignKey": "String",
    "campaignResolutionStatus": "String",
    "newFundedCustomers": "Int"
  },
  "OfflineActivityMonthly": {
    "observationMonth": "DateTime",
    "sourceChannel": "String",
    "mappingSourceCampaignId": "String",
    "resolvedCampaignKey": "String",
    "campaignResolutionStatus": "String",
    "geographySourceValue": "String",
    "metric": "String",
    "metricValue": "Int"
  },
  "SalesTargetAttainmentMonthly": {
    "targetMonth": "DateTime",
    "productId": "String",
    "marketId": "String",
    "targetFundedAccounts": "Int",
    "targetContributionUsd": "Float",
    "planVersion": "String",
    "openedAccounts": "Int",
    "fundedAccounts": "Int",
    "fundedAccountGap": "Int",
    "fundedAccountAttainment": "Float"
  },
  "VendorMediaDaily": {
    "resolvedCampaignKey": "String",
    "sourceTable": "String",
    "platform": "String",
    "reportDate": "DateTime",
    "reportEndDate": "DateTime",
    "sourceCampaignId": "String",
    "campaignResolutionStatus": "String",
    "currency": "String",
    "clickEvent": "String",
    "conversionEvent": "String",
    "conversionValueEvent": "String",
    "sourceRowCount": "Int",
    "reportedImpressions": "Int",
    "reportedClicks": "Int",
    "spendAmount": "Float",
    "reportedConversions": "Float",
    "reportedConversionValue": "Float",
    "reportedClickRate": "Float",
    "costPerReportedClick": "Float",
    "costPerThousandImpressions": "Float",
    "campaignName": "String"
  },
  "WebsiteEngagementDaily": {
    "sessionDate": "DateTime",
    "landingPagePath": "String",
    "deviceCategory": "String",
    "mappingSourceCampaignId": "String",
    "resolvedCampaignKey": "String",
    "campaignResolutionStatus": "String",
    "sessions": "Int",
    "sessionsWithEngagementFlag": "Int",
    "engagedSessions": "Int",
    "sessionsWithApplicationSubmit": "Int",
    "engagedSessionRate": "Float",
    "webApplicationSubmitRate": "Float"
  },
  "FxRate": {
    "rateDate": "DateTime",
    "baseCcy": "String",
    "quoteCcy": "String",
    "rate": "Float"
  },
  "SalesTargetOverrideCandidate": {
    "targetMonth": "DateTime",
    "productId": "String",
    "marketId": "String",
    "planVersion": "String",
    "selectedFundedAccounts": "Int",
    "selectedContributionUsd": "Float",
    "rejectedFundedAccounts": "Int",
    "rejectedContributionUsd": "Float",
    "overrideStatus": "String",
    "reason": "String",
    "dataMode": "String",
    "packVersion": "String"
  },
  "SourceAcceptanceCheck": {
    "checkId": "String",
    "acceptanceCriterion": "String",
    "observedResult": "String",
    "expectedResult": "String",
    "status": "String"
  }
};
