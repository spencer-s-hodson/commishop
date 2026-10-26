/**
 * Per-player valuation for the Trade Analyzer (H2H points leagues).
 *
 * ESPN stat line ids are `{split}{seasonYear}`:
 * - 00 = season actual, 01/02/03 = last 7/15/30 days
 * - 10 = ESPN season projection
 * `appliedAverage` is fantasy points per game under the league's scoring.
 */

export type EspnStatLine = {
  id?: string;
  statSourceId?: number;
  statSplitTypeId?: number;
  appliedTotal?: number;
  appliedAverage?: number;
  stats?: Record<string, number>;
};

/** ESPN basketball stat id for games played. */
const GAMES_PLAYED_STAT_ID = "42";
const NBA_SEASON_GAMES = 82;

/** Games of actual play before the season line outweighs the projection. */
const SEASON_SHRINK_GAMES = 15;
/** Max share of the blend given to last-15 form. */
const RECENT_FORM_WEIGHT = 0.2;
const RECENT_FORM_FULL_GAMES = 5;
const DEFAULT_PARTICIPATION = 0.8;

/**
 * Share of remaining games we expect a player to suit up for, by ESPN injury
 * status. ESPN doesn't publish return timelines, so these are coarse haircuts.
 */
const AVAILABILITY_BY_INJURY: Record<string, number> = {
  INJURY_RESERVE: 0.5,
  OUT: 0.8,
  SUSPENSION: 0.9,
  DOUBTFUL: 0.92,
  QUESTIONABLE: 0.96,
  DAY_TO_DAY: 0.97,
};

export type PlayerValuationSource = "blend" | "projection" | "prior" | "none";

export type PlayerValuation = {
  /** Fantasy points per game we expect going forward. */
  ppg: number;
  projectedPpg: number | null;
  seasonPpg: number | null;
  seasonGamesPlayed: number;
  recentPpg: number | null;
  /** Expected games played rest of season (schedule × participation × health). */
  gamesRemaining: number;
  availability: number;
  restOfSeasonPoints: number;
  source: PlayerValuationSource;
};

export function findStatLine(
  stats: EspnStatLine[] | undefined,
  split: "00" | "01" | "02" | "03" | "10",
  seasonYear: number,
): EspnStatLine | null {
  return stats?.find((line) => line.id === `${split}${seasonYear}`) ?? null;
}

function lineGamesPlayed(line: EspnStatLine | null): number {
  if (!line) return 0;
  const gp = line.stats?.[GAMES_PLAYED_STAT_ID];
  if (typeof gp === "number" && gp > 0) return gp;
  if (
    typeof line.appliedTotal === "number" &&
    typeof line.appliedAverage === "number" &&
    line.appliedAverage > 0
  ) {
    return Math.round(line.appliedTotal / line.appliedAverage);
  }
  return 0;
}

function lineAverage(line: EspnStatLine | null): number | null {
  if (!line) return null;
  if (typeof line.appliedAverage === "number" && line.appliedAverage > 0) {
    return line.appliedAverage;
  }
  const gp = lineGamesPlayed(line);
  if (typeof line.appliedTotal === "number" && line.appliedTotal > 0 && gp) {
    return line.appliedTotal / gp;
  }
  return null;
}

export function injuryAvailability(status: string | null | undefined) {
  const normalized = status
    ?.trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!normalized) return 1;
  return AVAILABILITY_BY_INJURY[normalized] ?? 1;
}

/**
 * Blend ESPN's projection with actual production, shrinking toward the
 * projection until a player has a meaningful sample, then nudge for form.
 */
export function valuePlayer(input: {
  stats: EspnStatLine[] | undefined;
  seasonYear: number;
  injuryStatus?: string | null;
  /** Remaining fantasy-season games for the player's NBA team. */
  teamGamesRemaining: number;
}): PlayerValuation {
  const { stats, seasonYear } = input;
  const projection = findStatLine(stats, "10", seasonYear);
  const season = findStatLine(stats, "00", seasonYear);
  const recent = findStatLine(stats, "02", seasonYear);
  const prior = findStatLine(stats, "00", seasonYear - 1);

  const projectedPpg = lineAverage(projection);
  const priorPpg = lineAverage(prior);
  const seasonPpg = lineAverage(season);
  const seasonGamesPlayed = lineGamesPlayed(season);
  const recentPpg = lineAverage(recent);
  const recentGames = lineGamesPlayed(recent);

  const baseline = projectedPpg ?? priorPpg;
  let ppg: number;
  let source: PlayerValuationSource;

  if (baseline == null && seasonPpg == null) {
    ppg = 0;
    source = "none";
  } else if (baseline == null) {
    ppg = seasonPpg!;
    source = "blend";
  } else if (seasonPpg == null || seasonGamesPlayed === 0) {
    ppg = baseline;
    source = projectedPpg != null ? "projection" : "prior";
  } else {
    const seasonWeight =
      seasonGamesPlayed / (seasonGamesPlayed + SEASON_SHRINK_GAMES);
    ppg = baseline * (1 - seasonWeight) + seasonPpg * seasonWeight;
    source = "blend";
  }

  if (recentPpg != null && recentGames > 0 && source !== "none") {
    const weight =
      RECENT_FORM_WEIGHT * Math.min(1, recentGames / RECENT_FORM_FULL_GAMES);
    ppg = ppg * (1 - weight) + recentPpg * weight;
  }

  const projectedGames = lineGamesPlayed(projection);
  const priorGames = lineGamesPlayed(prior);
  const participation = Math.min(
    1,
    Math.max(
      0.3,
      projectedGames > 0
        ? projectedGames / NBA_SEASON_GAMES
        : priorGames > 0
          ? priorGames / NBA_SEASON_GAMES
          : DEFAULT_PARTICIPATION,
    ),
  );

  const availability = injuryAvailability(input.injuryStatus);
  const gamesRemaining =
    Math.max(0, input.teamGamesRemaining) * participation * availability;

  return {
    ppg,
    projectedPpg,
    seasonPpg,
    seasonGamesPlayed,
    recentPpg,
    gamesRemaining,
    availability,
    restOfSeasonPoints: ppg * gamesRemaining,
    source,
  };
}

/** Exponent > 1 gives stars a consolidation premium over equal-sum depth. */
export const TRADE_VALUE_EXPONENT = 1.4;

/**
 * Raw (un-normalized) trade value: points over replacement per game, scaled
 * superlinearly, times expected games left.
 */
export function rawTradeValue(input: {
  ppg: number;
  gamesRemaining: number;
  replacementPpg: number;
}) {
  const overReplacement = Math.max(0, input.ppg - input.replacementPpg);
  return overReplacement ** TRADE_VALUE_EXPONENT * input.gamesRemaining;
}

/** Replacement level = mean PPG of the best few available free agents. */
export function replacementLevelPpg(freeAgentPpgs: number[], depth = 5) {
  const top = [...freeAgentPpgs]
    .filter((ppg) => ppg > 0)
    .sort((a, b) => b - a)
    .slice(0, depth);
  if (top.length === 0) return 0;
  return top.reduce((sum, ppg) => sum + ppg, 0) / top.length;
}
