/**
 * ESPN fantasy basketball calendar:
 * - Daily scoring periods are calendar days (constants.scoringPeriods)
 * - Weekly matchup windows live in constants.segments[].periodTypes where weekly=true
 * - League settings.scheduleSettings.matchupPeriods maps each matchup → weekly period ids
 *   (when periodTypeId=2). Playoff rounds may span multiple weekly periods (e.g. [20,21]).
 *
 * Lineup slots (espn-api basketball POSITION_MAP):
 * 0–10 starters/flex, 11 UTIL (scores), 12 BENCH, 13 IR
 */

export const BENCH_SLOT = 12;
export const IR_SLOT = 13;
export const NON_SCORING_SLOTS = new Set([BENCH_SLOT, IR_SLOT]);

export type EspnScoringPeriod = {
  id: number;
  startDate: number;
  endDate: number;
  preSeason?: boolean;
  postSeason?: boolean;
};

export type EspnWeeklyPeriod = {
  id: number;
  scoringPeriodStart: number;
  scoringPeriodEnd: number;
};

export type EspnGameConstants = {
  scoringPeriods: EspnScoringPeriod[];
  weeklyPeriods: EspnWeeklyPeriod[];
};

export type MatchupPeriodOption = {
  matchupPeriodId: number;
  label: string;
  shortLabel: string;
  scoringPeriodIds: number[];
  startDate: string | null;
  endDate: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function etYmd(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function formatWeekDateRange(startTs: number, endTs: number) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  });
  return `${fmt.format(new Date(startTs))}–${fmt.format(new Date(endTs))}`;
}

/** Calendar day represented by a scoring period (handles the long opening period). */
export function scoringPeriodDayTs(period: EspnScoringPeriod) {
  if (period.endDate - period.startDate > DAY_MS * 1.5) {
    return period.endDate - DAY_MS;
  }
  return period.startDate;
}

function rangeInclusive(start: number, end: number) {
  const ids: number[] = [];
  for (let id = start; id <= end; id++) ids.push(id);
  return ids;
}

function weeklyPeriodById(constants: EspnGameConstants) {
  return new Map(constants.weeklyPeriods.map((period) => [period.id, period]));
}

function scoringPeriodById(constants: EspnGameConstants) {
  return new Map(constants.scoringPeriods.map((period) => [period.id, period]));
}

/**
 * Expand a matchup period into daily scoring period ids using ESPN's weekly
 * calendar + the league's live matchupPeriods map.
 */
export function scoringPeriodsForMatchup(input: {
  matchupPeriodId: number;
  constants: EspnGameConstants;
  /** Live settings.scheduleSettings.matchupPeriods */
  matchupPeriods?: Record<string, number[]>;
  /** Fallback if constants / mapping are unavailable. */
  fallbackScoringPeriodIds?: number[];
}) {
  const weeklyIds = input.matchupPeriods?.[String(input.matchupPeriodId)] ?? [
    input.matchupPeriodId,
  ];

  const weeklyMap = weeklyPeriodById(input.constants);
  const scoringIds = new Set<number>();

  for (const weeklyId of weeklyIds) {
    const weekly = weeklyMap.get(weeklyId);
    if (!weekly) {
      // periodTypeId may be daily — treat values as scoring period ids.
      scoringIds.add(weeklyId);
      continue;
    }
    for (const id of rangeInclusive(
      weekly.scoringPeriodStart,
      weekly.scoringPeriodEnd,
    )) {
      scoringIds.add(id);
    }
  }

  if (scoringIds.size === 0) {
    return input.fallbackScoringPeriodIds ?? [];
  }

  return [...scoringIds].sort((a, b) => a - b);
}

function datesForScoringPeriods(
  scoringPeriodIds: number[],
  constants: EspnGameConstants,
) {
  const byId = scoringPeriodById(constants);
  return scoringPeriodIds
    .map((id) => byId.get(id))
    .filter((period): period is EspnScoringPeriod => period != null)
    .map(scoringPeriodDayTs);
}

export function buildMatchupPeriodOptions(input: {
  constants: EspnGameConstants;
  matchupPeriods?: Record<string, number[]>;
  matchupPeriodCount?: number;
  playoffMatchupPeriodLength?: number;
}) {
  const matchupPeriods = input.matchupPeriods ?? {};
  const scheduledIds = Object.keys(matchupPeriods)
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0)
    .sort((a, b) => a - b);

  const regularCount = input.matchupPeriodCount ?? 19;
  const ids =
    scheduledIds.length > 0
      ? scheduledIds
      : Array.from({ length: regularCount }, (_, i) => i + 1);

  const options: MatchupPeriodOption[] = [];

  for (const matchupPeriodId of ids) {
    const scoringPeriodIds = scoringPeriodsForMatchup({
      matchupPeriodId,
      constants: input.constants,
      matchupPeriods,
    });
    const dates = datesForScoringPeriods(scoringPeriodIds, input.constants);
    const startTs = dates.length ? Math.min(...dates) : null;
    const endTs = dates.length ? Math.max(...dates) : null;
    const range =
      startTs != null && endTs != null
        ? formatWeekDateRange(startTs, endTs)
        : null;

    const isPlayoff = matchupPeriodId > regularCount;
    const playoffRound = isPlayoff ? matchupPeriodId - regularCount : 0;
    const shortLabel = isPlayoff
      ? `Playoffs R${playoffRound}`
      : `Matchup ${matchupPeriodId}`;
    const label = range ? `${shortLabel} (${range})` : shortLabel;

    options.push({
      matchupPeriodId,
      shortLabel,
      label,
      scoringPeriodIds,
      startDate: startTs != null ? etYmd(startTs) : null,
      endDate: endTs != null ? etYmd(endTs) : null,
    });
  }

  return options;
}

/** Scoring period to request from ESPN for a selected matchup week. */
export function effectiveScoringPeriodId(input: {
  selectedMatchupPeriodId: number;
  currentMatchupPeriodId: number;
  liveScoringPeriodId: number;
  weekScoringPeriodIds: number[];
}) {
  const weekIds = input.weekScoringPeriodIds;
  if (weekIds.length === 0) return input.liveScoringPeriodId;

  if (input.selectedMatchupPeriodId === input.currentMatchupPeriodId) {
    const liveInWeek = weekIds.includes(input.liveScoringPeriodId);
    return liveInWeek
      ? input.liveScoringPeriodId
      : Math.max(
          ...weekIds.filter((id) => id <= input.liveScoringPeriodId),
          weekIds[0]!,
        );
  }

  if (input.selectedMatchupPeriodId < input.currentMatchupPeriodId) {
    return Math.max(...weekIds);
  }

  return Math.min(...weekIds);
}

/**
 * Parse ESPN game constants embedded in the Fantasy Basketball scoreboard page
 * (__NEXT_DATA__). These are season-level (not league-specific).
 */
export function parseGameConstantsFromScoreboardHtml(
  html: string,
): EspnGameConstants | null {
  const constantsIdx = html.indexOf('"constants":{');
  if (constantsIdx < 0) return null;

  let start = constantsIdx + '"constants":'.length;
  while (html[start] === " " || html[start] === "\n") start++;
  if (html[start] !== "{") return null;

  let depth = 0;
  let end = start;
  for (; end < html.length; end++) {
    const ch = html[end];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end++;
        break;
      }
    }
  }

  let constants: {
    scoringPeriods?: EspnScoringPeriod[];
    segments?: Array<{
      periodTypes?: Array<{
        weekly?: boolean;
        periods?: EspnWeeklyPeriod[];
      }>;
    }>;
  };
  try {
    constants = JSON.parse(html.slice(start, end)) as typeof constants;
  } catch {
    return null;
  }

  const scoringPeriods = (constants.scoringPeriods ?? []).filter(
    (period) =>
      typeof period?.id === "number" &&
      typeof period.startDate === "number" &&
      typeof period.endDate === "number",
  );

  const weeklyPeriods =
    constants.segments
      ?.flatMap((segment) => segment.periodTypes ?? [])
      .find((periodType) => periodType.weekly)?.periods ?? [];

  if (scoringPeriods.length === 0 || weeklyPeriods.length === 0) {
    return null;
  }

  return { scoringPeriods, weeklyPeriods };
}
