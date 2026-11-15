import { database } from './database';

const dayKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}-${parts.find(part => part.type === 'day')!.value}`;
};

export type AnalyticsSummary = { visitors: number; views: number };
export type AnalyticsDay = { day: string; visitors: number; views: number };

export function recordVisit(visitorId: string, date = new Date()) {
  database().prepare('INSERT INTO analytics_daily(day,visitor_id,views) VALUES(?,?,1) ON CONFLICT(day,visitor_id) DO UPDATE SET views=views+1').run(dayKey(date), visitorId);
}

export function visitorSummary(days: number): AnalyticsSummary {
  const since = dayKey(new Date(Date.now() - (days - 1) * 86400000));
  return database().prepare('SELECT COUNT(DISTINCT visitor_id) AS visitors, COALESCE(SUM(views),0) AS views FROM analytics_daily WHERE day>=?').get(since) as AnalyticsSummary;
}

export function dailyVisitors(days: number): AnalyticsDay[] {
  const since = dayKey(new Date(Date.now() - (days - 1) * 86400000));
  return database().prepare('SELECT day, COUNT(*) AS visitors, COALESCE(SUM(views),0) AS views FROM analytics_daily WHERE day>=? GROUP BY day ORDER BY day').all(since) as AnalyticsDay[];
}

export { dayKey };
