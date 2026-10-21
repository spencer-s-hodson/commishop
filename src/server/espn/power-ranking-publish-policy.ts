/** Utah / Mountain — used for the ~10am publish clock. */
export const UTAH_TZ = "America/Denver";
/** ESPN matchup endDate strings are formatted in Eastern. */
export const ESPN_CALENDAR_TZ = "America/New_York";

/** Calendar YYYY-MM-DD in an IANA timezone (DST-safe). */
export function ymdInTimeZone(timeZone: string, date: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Hour 0–23 in an IANA timezone (DST-safe). */
export function hourInTimeZone(timeZone: string, date: Date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
    }).format(date),
  );
  // en-US hour12:false can yield "24" for midnight in some engines
  return hour === 24 ? 0 : hour;
}

/**
 * Yesterday's calendar date in an IANA timezone (YYYY-MM-DD).
 * Uses Y-M-D arithmetic so DST spring/fall does not shift the day.
 */
export function yesterdayYmdInTimeZone(
  timeZone: string,
  date: Date = new Date(),
) {
  const today = ymdInTimeZone(timeZone, date);
  const [y, m, d] = today.split("-").map(Number);
  const yesterday = new Date(Date.UTC(y!, m! - 1, d! - 1));
  const yy = yesterday.getUTCFullYear();
  const mm = String(yesterday.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(yesterday.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function utahHour(date: Date = new Date()) {
  return hourInTimeZone(UTAH_TZ, date);
}

export function espnYesterdayYmd(date: Date = new Date()) {
  return yesterdayYmdInTimeZone(ESPN_CALENDAR_TZ, date);
}

export type PublishHourGateResult =
  | {
      skipped: true;
      reason: string;
      hour: number;
    }
  | {
      skipped: false;
      hour: number;
      yesterday: string;
    };

/**
 * Utah 10am gate for the daily publish check.
 * `force` bypasses the hour window (manual / local testing).
 */
export function evaluatePublishHourGate(
  now: Date,
  options?: { force?: boolean },
): PublishHourGateResult {
  const hour = utahHour(now);
  if (!options?.force && hour !== 10) {
    return {
      skipped: true,
      reason: `Utah hour is ${hour}, expected 10 for publish check`,
      hour,
    };
  }
  return {
    skipped: false,
    hour,
    yesterday: espnYesterdayYmd(now),
  };
}

export type MatchupEndOption = {
  matchupPeriodId: number;
  endDate: string | null;
  label?: string;
};

/** Matchup periods whose ESPN Eastern endDate equals yesterday. */
export function matchupsEndingOn(
  options: MatchupEndOption[],
  yesterday: string,
): MatchupEndOption[] {
  return options.filter((option) => option.endDate === yesterday);
}
