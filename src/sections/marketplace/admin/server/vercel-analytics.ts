import 'server-only';

type VercelVisitRow = {
  timestamp?: string;
  requestPath?: string;
  referrerHostname?: string;
  deviceType?: string;
  country?: string;
  pageviews?: number;
  visitors?: number;
};

type VercelVisitResponse = {
  data?: VercelVisitRow[];
  error?: { message?: string };
};

export type VercelMarketingAnalytics = {
  connected: boolean;
  message?: string;
  pageviews: number;
  visitors: number;
  daily: Array<{ date: string; pageviews: number; visitors: number }>;
  topPages: Array<{ label: string; pageviews: number; visitors: number }>;
  topReferrers: Array<{ label: string; pageviews: number; visitors: number }>;
  devices: Array<{ label: string; pageviews: number; visitors: number }>;
  countries: Array<{ label: string; pageviews: number; visitors: number }>;
};

const EMPTY_ANALYTICS: VercelMarketingAnalytics = {
  connected: false,
  pageviews: 0,
  visitors: 0,
  daily: [],
  topPages: [],
  topReferrers: [],
  devices: [],
  countries: [],
};

function formatApiDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function asNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeRows(rows: VercelVisitRow[] | undefined, dimension: keyof VercelVisitRow) {
  return (rows ?? []).map((row) => ({
    label: String(row[dimension] ?? 'ไม่ระบุ'),
    pageviews: asNumber(row.pageviews),
    visitors: asNumber(row.visitors),
  }));
}

export async function getVercelMarketingAnalytics(since: Date, until: Date) {
  const token = process.env.MARKETPLACE_VERCEL_API_TOKEN;
  const projectId = process.env.MARKETPLACE_VERCEL_PROJECT_ID ?? process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.MARKETPLACE_VERCEL_TEAM_ID ?? process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    return {
      ...EMPTY_ANALYTICS,
      message:
        'เพิ่ม MARKETPLACE_VERCEL_API_TOKEN และ MARKETPLACE_VERCEL_PROJECT_ID เพื่อเชื่อมข้อมูล',
    };
  }

  const baseParams = new URLSearchParams({
    projectId,
    since: formatApiDate(since),
    until: formatApiDate(until),
    filter: "environment eq 'production'",
  });
  if (teamId) baseParams.set('teamId', teamId);

  const query = async (by: string, limit?: number) => {
    const params = new URLSearchParams(baseParams);
    params.set('by', by);
    if (limit) params.set('limit', String(limit));

    const response = await fetch(
      `https://api.vercel.com/v1/query/web-analytics/visits/aggregate?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      }
    );
    const result = (await response.json()) as VercelVisitResponse;
    if (!response.ok) {
      throw new Error(result.error?.message ?? `Vercel API ตอบกลับ ${response.status}`);
    }
    return result.data ?? [];
  };

  try {
    const [dailyRows, pageRows, referrerRows, deviceRows, countryRows] = await Promise.all([
      query('day'),
      query('requestPath', 10),
      query('referrerHostname', 10),
      query('deviceType', 10),
      query('country', 10),
    ]);
    const daily = dailyRows.map((row) => ({
      date: String(row.timestamp ?? '').slice(0, 10),
      pageviews: asNumber(row.pageviews),
      visitors: asNumber(row.visitors),
    }));

    return {
      connected: true,
      pageviews: daily.reduce((sum, row) => sum + row.pageviews, 0),
      visitors: daily.reduce((sum, row) => sum + row.visitors, 0),
      daily,
      topPages: normalizeRows(pageRows, 'requestPath'),
      topReferrers: normalizeRows(referrerRows, 'referrerHostname'),
      devices: normalizeRows(deviceRows, 'deviceType'),
      countries: normalizeRows(countryRows, 'country'),
    } satisfies VercelMarketingAnalytics;
  } catch (error) {
    return {
      ...EMPTY_ANALYTICS,
      message: error instanceof Error ? error.message : 'เชื่อมต่อ Vercel Web Analytics ไม่สำเร็จ',
    };
  }
}
