import { tableWhere } from "@/lib/server/filters";
import { withApiErrors } from "@/lib/server/api-errors";
// ============================================================
// GET /api/digital — Website + Email + Organic Social analytics
// (DigitalResponse contract; see src/lib/api-types.ts)
// Sources (gold_business): mart_website_engagement_daily,
// mart_email_engagement_daily, dim_social_campaign, dim_campaign.
// dim_social_campaign carries no reach/engagement metrics — the
// social section is a registry view (posts / platforms /
// resolution / legal-clearance rates).
// ============================================================
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { DigitalResponse } from "@/lib/api-types";
import { parseFilters, webWhere, emailMartWhere } from "@/lib/server/filters";
import { dateKey, safeDiv, round2, round4, groupBy, sumBy } from "@/lib/server/helpers";

export const dynamic = "force-dynamic";

interface WebRow {
  sessionDate: Date;
  landingPagePath: string;
  deviceCategory: string;
  resolvedCampaignKey: string | null;
  sessions: number;
  engagedSessions: number;
  sessionsWithApplicationSubmit: number;
}

/** Sessions + engaged/submit rates for a bucket of web engagement rows. */
function webMetrics(rows: WebRow[]): { sessions: number; engagedRate: number; submitRate: number } {
  const sessions = sumBy(rows, (r) => r.sessions);
  const engaged = sumBy(rows, (r) => r.engagedSessions);
  const submits = sumBy(rows, (r) => r.sessionsWithApplicationSubmit);
  return {
    sessions,
    engagedRate: round4(safeDiv(engaged, sessions)),
    submitRate: round4(safeDiv(submits, sessions)),
  };
}

async function handleGet(req: Request) {
  const f = await parseFilters(req);

  const socialWhere = tableWhere("SocialCampaign", f);

  const [webRows, emailRows, socialRows, campaigns] = await Promise.all([
    db.websiteEngagementDaily.selectRows({
      where: webWhere(f),
      select: {
        sessionDate: true,
        landingPagePath: true,
        deviceCategory: true,
        resolvedCampaignKey: true,
        sessions: true,
        engagedSessions: true,
        sessionsWithApplicationSubmit: true,
      },
    }),
    db.emailEngagementDaily.selectRows({
      where: emailMartWhere(f),
      select: {
        sendDt: true,
        resolvedCampaignKey: true,
        sent: true,
        delivered: true,
        uniqueOpens: true,
        uniqueClicks: true,
        hardSoftBounces: true,
        optOuts: true,
      },
    }),
    db.socialCampaign.selectRows({
      where: socialWhere,
      select: {
        postCampaignRef: true,
        platform: true,
        contentTheme: true,
        postType: true,
        publishDt: true,
        campaignGoal: true,
        legalCopyStatus: true,
        resolvedCampaignKey: true,
        campaignResolutionStatus: true,
      },
    }),
    db.campaign.selectRows({ select: { campaignKey: true, campaignTitle: true } }),
  ]);

  const campaignTitle = new Map(campaigns.map((c) => [c.campaignKey, c.campaignTitle]));

  // ---------- website ----------
  const sessions = sumBy(webRows, (r) => r.sessions);
  const engagedTotal = sumBy(webRows, (r) => r.engagedSessions);
  const submitsTotal = sumBy(webRows, (r) => r.sessionsWithApplicationSubmit);
  const distinctDays = new Set(webRows.map((r) => dateKey(r.sessionDate))).size;

  const webKpis: DigitalResponse["webKpis"] = {
    sessions,
    engagedRate: round4(safeDiv(engagedTotal, sessions)),
    submitRate: round4(safeDiv(submitsTotal, sessions)),
    avgSessionsPerDay: round2(safeDiv(sessions, distinctDays)),
  };

  const webDaily = Array.from(groupBy(webRows, (r) => dateKey(r.sessionDate)).entries())
    .map(([date, rows]) => ({
      date,
      sessions: sumBy(rows, (r) => r.sessions),
      engaged: sumBy(rows, (r) => r.engagedSessions),
      submits: sumBy(rows, (r) => r.sessionsWithApplicationSubmit),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const landingPages = Array.from(groupBy(webRows, (r) => r.landingPagePath).entries())
    .map(([path, rows]) => ({ path, ...webMetrics(rows) }))
    .sort((a, b) => b.sessions - a.sessions);

  const devices = Array.from(groupBy(webRows, (r) => r.deviceCategory).entries())
    .map(([device, rows]) => ({ device, ...webMetrics(rows) }))
    .sort((a, b) => b.sessions - a.sessions);

  const attribution = Array.from(
    groupBy(webRows, (r) => (r.resolvedCampaignKey === null ? "Unattributed" : "Attributed")).entries()
  )
    .map(([status, rows]) => ({ status, ...webMetrics(rows) }))
    .sort((a, b) => b.sessions - a.sessions);

  // ---------- email ----------
  const sent = sumBy(emailRows, (r) => r.sent);
  const delivered = sumBy(emailRows, (r) => r.delivered);
  const opens = sumBy(emailRows, (r) => r.uniqueOpens);
  const clicks = sumBy(emailRows, (r) => r.uniqueClicks);
  const bounces = sumBy(emailRows, (r) => r.hardSoftBounces);
  const optOuts = sumBy(emailRows, (r) => r.optOuts);

  const emailKpis: DigitalResponse["emailKpis"] = {
    sent,
    delivered,
    deliveryRate: round4(safeDiv(delivered, sent)),
    openRate: round4(safeDiv(opens, delivered)),
    clickRate: round4(safeDiv(clicks, delivered)),
    bounceRate: round4(safeDiv(bounces, sent)),
    optOutRate: round4(safeDiv(optOuts, delivered)),
  };

  const emailDaily = Array.from(groupBy(emailRows, (r) => dateKey(r.sendDt)).entries())
    .map(([date, rows]) => ({
      date,
      sent: sumBy(rows, (r) => r.sent),
      delivered: sumBy(rows, (r) => r.delivered),
      opens: sumBy(rows, (r) => r.uniqueOpens),
      clicks: sumBy(rows, (r) => r.uniqueClicks),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const emailByCampaign = new Map<string, typeof emailRows>();
  for (const r of emailRows) {
    if (r.resolvedCampaignKey === null) continue;
    const list = emailByCampaign.get(r.resolvedCampaignKey);
    if (list) list.push(r);
    else emailByCampaign.set(r.resolvedCampaignKey, [r]);
  }
  const emailCampaigns = Array.from(emailByCampaign.entries())
    .map(([campaignKey, rows]) => {
      const sends = sumBy(rows, (r) => r.sent);
      const campDelivered = sumBy(rows, (r) => r.delivered);
      return {
        campaignKey,
        campaignTitle: campaignTitle.get(campaignKey) ?? campaignKey,
        sends,
        openRate: round4(safeDiv(sumBy(rows, (r) => r.uniqueOpens), campDelivered)),
        clickRate: round4(safeDiv(sumBy(rows, (r) => r.uniqueClicks), campDelivered)),
        optOutRate: round4(safeDiv(sumBy(rows, (r) => r.optOuts), campDelivered)),
      };
    })
    .sort((a, b) => b.sends - a.sends);

  // ---------- organic social (registry — no reach/engagement metrics) ----------
  const posts = socialRows.length;
  const platforms = new Set(socialRows.map((r) => r.platform)).size;
  const resolvedCount = socialRows.filter((r) => r.resolvedCampaignKey !== null).length;
  const clearedCount = socialRows.filter((r) => r.legalCopyStatus === "Cleared").length;

  const socialKpis: DigitalResponse["socialKpis"] = {
    posts,
    platforms,
    resolvedRate: round4(safeDiv(resolvedCount, posts)),
    clearedRate: round4(safeDiv(clearedCount, posts)),
  };

  const socialPlatform = Array.from(groupBy(socialRows, (r) => r.platform).entries())
    .map(([platform, rows]) => ({ platform, posts: rows.length }))
    .sort((a, b) => b.posts - a.posts);

  const socialCampaigns = [...socialRows]
    .sort(
      (a, b) =>
        b.publishDt.getTime() - a.publishDt.getTime() ||
        a.postCampaignRef.localeCompare(b.postCampaignRef)
    )
    .slice(0, 150)
    .map((r) => ({
      postRef: r.postCampaignRef,
      platform: r.platform,
      theme: r.contentTheme,
      postType: r.postType,
      publishDate: dateKey(r.publishDt),
      goal: r.campaignGoal,
      legalStatus: r.legalCopyStatus,
      campaignTitle:
        (r.resolvedCampaignKey !== null ? campaignTitle.get(r.resolvedCampaignKey) : undefined) ??
        "Unresolved",
      resolutionStatus: r.campaignResolutionStatus,
    }));

  const res: DigitalResponse = {
    webKpis,
    webDaily,
    landingPages,
    devices,
    attribution,
    emailKpis,
    emailDaily,
    emailCampaigns,
    socialKpis,
    socialPlatform,
    socialCampaigns,
  };
  return NextResponse.json(res);
}

export const GET = withApiErrors(handleGet);
