import "server-only";

import {
  computePowerRankings,
  type PowerRankingWeeklyResult,
} from "@/server/espn/power-rankings";
import {
  buildMatchupPeriodOptions,
  type MatchupPeriodOption,
} from "@/server/espn/scoring-periods";
import {
  DEFAULT_LEAGUE_LOGO_URL,
  buildMemberMap,
  buildTeamMap,
  fetchEspnGameConstants,
  fetchEspnLeague,
  isCategoryScoring,
  normalizeLogoUrl,
  sideMatchupScore,
  type EspnCredentials,
  type EspnLeagueResponse,
  type EspnScheduleEntry,
  type EspnScheduleSide,
  type EspnTeam,
} from "@/server/espn/shared";

export type EspnPowerRankingRow = {
  teamId: number;
  name: string;
  abbrev: string;
  logoUrl: string | null;
  ownerName: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  /** ESPN / standings rank (1 = first) for Δ vs power rank. */
  standingsRank: number;
  /** Power ranking position (1 = strongest). */
  rank: number;
  powerScore: number;
  dominance: number;
  avgScore: number;
  avgMov: number;
  weeksPlayed: number;
};

export type EspnPowerRankings = {
  leagueId: number;
  seasonYear: number;
  name: string;
  logoUrl: string | null;
  scoringType: string | null;
  currentMatchupPeriod: number;
  /** Last matchup period included in the formula (completed weeks). */
  throughMatchupPeriod: number;
  rankings: EspnPowerRankingRow[];
};

/**
 * Collect per-team weekly H2H results through the last completed matchup period.
 * Skips byes and matchups missing a score on either side.
 */
function collectWeeklyResults(
  schedule: EspnScheduleEntry[],
  throughMatchupPeriod: number,
  categoryLeague: boolean,
): PowerRankingWeeklyResult[] {
  const results: PowerRankingWeeklyResult[] = [];

  for (const entry of schedule) {
    const period = entry.matchupPeriodId;
    if (typeof period !== "number" || period < 1 || period > throughMatchupPeriod) {
      continue;
    }

    const homeId = entry.home?.teamId;
    const awayId = entry.away?.teamId;
    if (typeof homeId !== "number" || typeof awayId !== "number") continue;

    const homeScore = sideMatchupScore(entry.home, categoryLeague);
    const awayScore = sideMatchupScore(entry.away, categoryLeague);
    if (homeScore == null || awayScore == null) continue;

    results.push({
      teamId: homeId,
      opponentId: awayId,
      score: homeScore,
      mov: homeScore - awayScore,
    });
    results.push({
      teamId: awayId,
      opponentId: homeId,
      score: awayScore,
      mov: awayScore - homeScore,
    });
  }

  return results;
}

function standingsRankForTeam(
  team: EspnTeam,
  fallbackIndex: number,
): number {
  const sim = team.currentSimulationResults;
  return (
    (typeof team.currentProjectedRank === "number" &&
    team.currentProjectedRank > 0
      ? team.currentProjectedRank
      : null) ??
    (typeof sim?.rank === "number" && sim.rank > 0 ? sim.rank : null) ??
    (typeof team.playoffSeed === "number" && team.playoffSeed > 0
      ? team.playoffSeed
      : null) ??
    fallbackIndex + 1
  );
}

export type EspnDraftDayTeamRow = {
  teamId: number;
  name: string;
  abbrev: string;
  logoUrl: string | null;
  ownerName: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  /** ESPN draft-day projected rank (1 = strongest). */
  draftDayProjectedRank: number;
};

/**
 * Team roster-strength ordering from ESPN draft-day projections (preseason).
 */
export async function fetchEspnDraftDayRankings(
  leagueId: number,
  seasonYear: number,
  credentials?: EspnCredentials,
): Promise<{
  leagueId: number;
  seasonYear: number;
  name: string;
  teams: EspnDraftDayTeamRow[];
}> {
  const data = await fetchEspnLeague(
    leagueId,
    seasonYear,
    ["mSettings", "mTeam", "mStandings"],
    credentials,
  );

  const name = data.settings?.name?.trim() ?? `League ${leagueId}`;
  const memberMap = buildMemberMap(data.members ?? []);
  const teamMap = buildTeamMap(data.teams ?? [], memberMap);

  const teams: EspnDraftDayTeamRow[] = [...teamMap.entries()]
    .map(([teamId, info], index) => {
      const overall = info.team.record?.overall;
      const draftRank =
        typeof info.team.draftDayProjectedRank === "number" &&
        info.team.draftDayProjectedRank > 0
          ? info.team.draftDayProjectedRank
          : index + 1;
      return {
        teamId,
        name: info.name,
        abbrev: info.abbrev,
        logoUrl: info.logoUrl,
        ownerName: info.ownerName,
        wins: overall?.wins ?? 0,
        losses: overall?.losses ?? 0,
        ties: overall?.ties ?? 0,
        pointsFor: overall?.pointsFor ?? 0,
        pointsAgainst: overall?.pointsAgainst ?? 0,
        draftDayProjectedRank: draftRank,
      };
    })
    .sort((a, b) => {
      if (a.draftDayProjectedRank !== b.draftDayProjectedRank) {
        return a.draftDayProjectedRank - b.draftDayProjectedRank;
      }
      return a.teamId - b.teamId;
    });

  return {
    leagueId: data.id ?? leagueId,
    seasonYear: data.seasonId ?? seasonYear,
    name,
    teams,
  };
}

/**
 * ESPN Fantasy Football–style power rankings for a basketball league.
 * Uses completed matchup periods through `throughMatchupPeriod`
 * (defaults to currentMatchupPeriod − 1).
 */
export async function fetchEspnPowerRankings(
  leagueId: number,
  seasonYear: number,
  credentials?: EspnCredentials,
  options?: { throughMatchupPeriod?: number },
): Promise<EspnPowerRankings> {
  const data = await fetchEspnLeague(
    leagueId,
    seasonYear,
    ["mSettings", "mTeam", "mStandings", "mMatchupScore"],
    credentials,
  );

  const name = data.settings?.name?.trim() ?? `League ${leagueId}`;
  const scoringType = data.settings?.scoringSettings?.scoringType ?? null;
  const categoryLeague = isCategoryScoring(scoringType);
  const currentMatchupPeriod =
    data.status?.currentMatchupPeriod ?? data.scoringPeriodId ?? 1;
  const throughMatchupPeriod =
    options?.throughMatchupPeriod ??
    Math.max(1, currentMatchupPeriod - 1);

  const memberMap = buildMemberMap(data.members ?? []);
  const teamMap = buildTeamMap(data.teams ?? [], memberMap);
  const teamList = [...teamMap.entries()].map(([teamId, info]) => ({
    teamId,
    info,
  }));

  const weeklyResults = collectWeeklyResults(
    data.schedule ?? [],
    throughMatchupPeriod,
    categoryLeague,
  );

  const computed = computePowerRankings(
    teamList.map(({ teamId }) => ({ teamId })),
    weeklyResults,
  );
  const computedById = new Map(computed.map((row) => [row.teamId, row]));

  const rankings: EspnPowerRankingRow[] = teamList
    .map(({ teamId, info }, index) => {
      const overall = info.team.record?.overall;
      const power = computedById.get(teamId);
      return {
        teamId,
        name: info.name,
        abbrev: info.abbrev,
        logoUrl: info.logoUrl,
        ownerName: info.ownerName,
        wins: overall?.wins ?? 0,
        losses: overall?.losses ?? 0,
        ties: overall?.ties ?? 0,
        pointsFor: overall?.pointsFor ?? 0,
        pointsAgainst: overall?.pointsAgainst ?? 0,
        standingsRank: standingsRankForTeam(info.team, index),
        rank: power?.rank ?? teamList.length,
        powerScore: power?.powerScore ?? 0,
        dominance: power?.dominance ?? 0,
        avgScore: power?.avgScore ?? 0,
        avgMov: power?.avgMov ?? 0,
        weeksPlayed: power?.weeksPlayed ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return b.powerScore - a.powerScore;
    });

  return {
    leagueId: data.id ?? leagueId,
    seasonYear: data.seasonId ?? seasonYear,
    name,
    logoUrl: normalizeLogoUrl(data.settings?.logo) ?? DEFAULT_LEAGUE_LOGO_URL,
    scoringType,
    currentMatchupPeriod,
    throughMatchupPeriod,
    rankings,
  };
}

/**
 * Matchup period calendar options (labels + end dates) for cron publish detection.
 */
export async function fetchEspnMatchupPeriodOptions(
  leagueId: number,
  seasonYear: number,
  credentials?: EspnCredentials,
): Promise<MatchupPeriodOption[]> {
  const bootstrap = await fetchEspnLeague(
    leagueId,
    seasonYear,
    ["mSettings", "mScoreboard"],
    credentials,
  );
  const schedule = bootstrap.settings?.scheduleSettings;
  const gameConstants = await fetchEspnGameConstants(
    seasonYear,
    leagueId,
    credentials,
  );
  return buildMatchupPeriodOptions({
    constants: gameConstants,
    matchupPeriods: schedule?.matchupPeriods ?? {},
    matchupPeriodCount: schedule?.matchupPeriodCount,
    playoffMatchupPeriodLength: schedule?.playoffMatchupPeriodLength,
  });
}
