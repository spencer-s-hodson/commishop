import "server-only";

import { NON_SCORING_SLOTS } from "@/server/espn/scoring-periods";
import { espnStyleWinProbability } from "@/server/espn/win-probability";

const GAMES_PER_SEASON = 82;
const CEILING_MULT = 1.65;
const DEFAULT_PROJ_PER_GAME = 22;

export type MatchupProjectionSide = {
  liveScore: number;
  projectedScore: number;
  ceilingScore: number;
  /** Active-roster NBA games scheduled in this fantasy week (volume). */
  gamesThisWeek: number;
  gamesRemaining: number;
  playersRemaining: number;
};

export type MatchupWinModel = {
  home: MatchupProjectionSide;
  away: MatchupProjectionSide;
  homeWinProbability: number;
  awayWinProbability: number;
};

type ProGame = {
  id?: number;
  date?: number;
  scoringPeriodId?: number;
  homeProTeamId?: number;
  awayProTeamId?: number;
};

type PlayerStat = {
  id?: string;
  statSourceId?: number;
  statSplitTypeId?: number;
  appliedTotal?: number;
};

type RosterEntry = {
  lineupSlotId?: number;
  playerId?: number;
  injuryStatus?: string;
  playerPoolEntry?: {
    appliedStatTotal?: number;
    player?: {
      fullName?: string;
      proTeamId?: number;
      injuryStatus?: string;
      stats?: PlayerStat[];
    };
  };
};

type ScheduleSide = {
  teamId?: number;
  totalPoints?: number;
  totalPointsLive?: number;
  rosterForCurrentScoringPeriod?: { entries?: RosterEntry[] };
  rosterForMatchupPeriod?: { entries?: RosterEntry[] };
};

export type NbaGameProgress = {
  remainingFraction: number;
  isFinal: boolean;
  hasStarted: boolean;
};

function isActiveLineupSlot(slotId: number | undefined) {
  if (slotId == null) return false;
  // Basketball: 0–10 positional, 11 UTIL score; 12 BENCH and 13 IR do not.
  return !NON_SCORING_SLOTS.has(slotId);
}

/**
 * ESPN "O" / OUT handling:
 * - Live points already earned stay in the matchup total (via ESPN totals).
 * - We do NOT project any remaining fantasy points for OUT players, even if
 *   they started today's game and then left — remaining = 0 going forward.
 * DAY_TO_DAY / QUESTIONABLE still get remaining projections.
 */
export function isPlayerOut(status: string | undefined) {
  if (!status) return false;
  const normalized = status.toUpperCase();
  return (
    normalized === "OUT" ||
    normalized === "INJURY_RESERVE" ||
    normalized === "IR" ||
    normalized === "SUSPENSION"
  );
}

export function liveSideScore(side: ScheduleSide | undefined) {
  if (typeof side?.totalPointsLive === "number") return side.totalPointsLive;
  if (typeof side?.totalPoints === "number") return side.totalPoints;
  const roster =
    side?.rosterForCurrentScoringPeriod ?? side?.rosterForMatchupPeriod;
  const entries = roster?.entries ?? [];
  return entries
    .filter((entry) => isActiveLineupSlot(entry.lineupSlotId))
    .reduce(
      (sum, entry) => sum + (entry.playerPoolEntry?.appliedStatTotal ?? 0),
      0,
    );
}

export function collectActivePlayerIds(side: ScheduleSide | undefined) {
  const roster =
    side?.rosterForCurrentScoringPeriod ?? side?.rosterForMatchupPeriod;
  const ids: number[] = [];
  for (const entry of roster?.entries ?? []) {
    if (!isActiveLineupSlot(entry.lineupSlotId)) continue;
    if (typeof entry.playerId === "number") ids.push(entry.playerId);
  }
  return ids;
}

function seasonProjectionPerGame(stats: PlayerStat[] | undefined, seasonYear: number) {
  const list = stats ?? [];
  const projected = list.find(
    (stat) =>
      stat.statSourceId === 1 &&
      stat.statSplitTypeId === 0 &&
      (stat.id === `10${seasonYear}` || Boolean(stat.id?.startsWith("10"))),
  );
  if (typeof projected?.appliedTotal === "number" && projected.appliedTotal > 0) {
    return projected.appliedTotal / GAMES_PER_SEASON;
  }

  const priorActual = list.find(
    (stat) =>
      stat.statSourceId === 0 &&
      stat.statSplitTypeId === 0 &&
      typeof stat.appliedTotal === "number" &&
      stat.appliedTotal > 100,
  );
  if (priorActual?.appliedTotal) {
    return priorActual.appliedTotal / GAMES_PER_SEASON;
  }

  return DEFAULT_PROJ_PER_GAME;
}

function remainingFractionForGame(input: {
  game: ProGame;
  scoringPeriodId: number;
  now: number;
  progressByProTeam: Map<number, NbaGameProgress>;
  proTeamId: number;
}) {
  const gamePeriod = input.game.scoringPeriodId ?? 0;
  if (gamePeriod < input.scoringPeriodId) return 0;
  if (gamePeriod > input.scoringPeriodId) return 1;

  const progress = input.progressByProTeam.get(input.proTeamId);
  if (progress) {
    if (progress.isFinal) return 0;
    if (progress.hasStarted) return progress.remainingFraction;
  }

  if (typeof input.game.date === "number") {
    if (input.game.date > input.now + 5 * 60 * 1000) return 1;
    if (input.game.date <= input.now) return 0.45;
  }

  return 1;
}

export function projectMatchupSide(input: {
  side: ScheduleSide | undefined;
  scoringPeriodIds: number[];
  currentScoringPeriodId: number;
  seasonYear: number;
  proGamesByTeam: Map<number, ProGame[]>;
  projectionByPlayerId: Map<number, number>;
  progressByProTeam: Map<number, NbaGameProgress>;
  /** Prefer roster/kona injury map — boxscore often omits injuryStatus. */
  injuryByPlayerId?: Map<number, string>;
  now?: number;
}): MatchupProjectionSide {
  const now = input.now ?? Date.now();
  const liveScore = liveSideScore(input.side);
  const roster =
    input.side?.rosterForCurrentScoringPeriod ??
    input.side?.rosterForMatchupPeriod;
  const entries = (roster?.entries ?? []).filter((entry) =>
    isActiveLineupSlot(entry.lineupSlotId),
  );

  let remainingPoints = 0;
  let remainingCeiling = 0;
  let gamesThisWeek = 0;
  let gamesRemaining = 0;
  let playersRemaining = 0;

  for (const entry of entries) {
    const player = entry.playerPoolEntry?.player;
    const playerId = entry.playerId;
    const proTeamId = player?.proTeamId;
    const injury =
      (playerId != null
        ? input.injuryByPlayerId?.get(playerId)
        : undefined) ??
      player?.injuryStatus ??
      entry.injuryStatus;
    // OUT: keep live ESPN points; project no remaining games/points.
    if (isPlayerOut(injury)) continue;
    if (proTeamId == null || proTeamId === 0) continue;

    const projPerGame =
      (playerId != null
        ? input.projectionByPlayerId.get(playerId)
        : undefined) ??
      seasonProjectionPerGame(player?.stats, input.seasonYear);

    const teamGames = input.proGamesByTeam.get(proTeamId) ?? [];
    const matchupGames = teamGames.filter((game) =>
      input.scoringPeriodIds.includes(game.scoringPeriodId ?? -1),
    );

    gamesThisWeek += matchupGames.length;

    let playerRemaining = 0;
    let playerRemainingGames = 0;

    for (const game of matchupGames) {
      const fraction = remainingFractionForGame({
        game,
        scoringPeriodId: input.currentScoringPeriodId,
        now,
        progressByProTeam: input.progressByProTeam,
        proTeamId,
      });
      if (fraction <= 0) continue;
      playerRemaining += projPerGame * fraction;
      playerRemainingGames += fraction;
    }

    if (playerRemainingGames > 0) {
      playersRemaining += 1;
      gamesRemaining += playerRemainingGames;
      remainingPoints += playerRemaining;
      remainingCeiling += playerRemaining * CEILING_MULT;
    }
  }

  return {
    liveScore,
    projectedScore: liveScore + remainingPoints,
    ceilingScore: liveScore + remainingCeiling,
    gamesThisWeek,
    gamesRemaining: Math.round(gamesRemaining * 10) / 10,
    playersRemaining,
  };
}

export function buildMatchupWinModel(
  home: MatchupProjectionSide,
  away: MatchupProjectionSide,
): MatchupWinModel {
  const remaining = home.gamesRemaining > 0 || away.gamesRemaining > 0;
  const homeWinProbability = espnStyleWinProbability({
    teamProjected: home.projectedScore,
    teamCeiling: home.ceilingScore,
    opponentProjected: away.projectedScore,
    opponentCeiling: away.ceilingScore,
    minutesOrGamesRemaining: remaining,
  });

  return {
    home,
    away,
    homeWinProbability,
    awayWinProbability: 1 - homeWinProbability,
  };
}

export function parseNbaScoreboardProgress(
  scoreboard: {
    events?: Array<{
      status?: { type?: { name?: string } };
      competitions?: Array<{
        status?: {
          type?: { name?: string; completed?: boolean };
          period?: number;
          clock?: number;
        };
        competitors?: Array<{
          team?: { id?: string };
        }>;
      }>;
    }>;
  } | null,
): Map<number, NbaGameProgress> {
  const map = new Map<number, NbaGameProgress>();
  for (const event of scoreboard?.events ?? []) {
    const competition = event.competitions?.[0];
    const statusName =
      competition?.status?.type?.name ?? event.status?.type?.name ?? "";
    const period = competition?.status?.period ?? 0;
    const clockSeconds = competition?.status?.clock ?? 0;
    const completed =
      competition?.status?.type?.completed === true ||
      statusName === "STATUS_FINAL";
    const scheduled = statusName === "STATUS_SCHEDULED";
    const inProgress =
      statusName === "STATUS_IN_PROGRESS" || statusName === "STATUS_HALFTIME";

    let remainingFraction = 1;
    if (completed) remainingFraction = 0;
    else if (statusName === "STATUS_HALFTIME") remainingFraction = 0.5;
    else if (inProgress) {
      const elapsedInPeriod = Math.max(0, 12 * 60 - clockSeconds) / 60;
      const elapsed = Math.max(0, period - 1) * 12 + elapsedInPeriod;
      remainingFraction = Math.min(1, Math.max(0, 1 - elapsed / 48));
    } else if (!scheduled) {
      remainingFraction = 0.4;
    }

    const progress: NbaGameProgress = {
      remainingFraction,
      isFinal: completed,
      hasStarted: !scheduled,
    };
    for (const competitor of competition?.competitors ?? []) {
      const id = Number(competitor.team?.id);
      if (Number.isFinite(id)) map.set(id, progress);
    }
  }
  return map;
}
