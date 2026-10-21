/**
 * Deterministic fake matchup data for local power-ranking previews.
 * Used when matchupPeriodId >= MOCK_MATCHUP_PERIOD_BASE (dev mock editions).
 */

import type {
  BlurbCompletedMatchup,
  BlurbScheduleContext,
  BlurbUpcomingMatchup,
} from "@/server/espn/power-ranking-blurb-prompt";
import {
  computePowerRankings,
  type PowerRankingWeeklyResult,
} from "@/server/espn/power-rankings";

/** Reserved ESPN-style period ids for local mocks (won't collide with real weeks). */
export const MOCK_MATCHUP_PERIOD_BASE = 900;

export function isMockMatchupPeriod(matchupPeriodId: number) {
  return matchupPeriodId >= MOCK_MATCHUP_PERIOD_BASE;
}

export function mockMatchupPeriodId(week: number) {
  return MOCK_MATCHUP_PERIOD_BASE + week;
}

export function mockEditionLabel(week: number) {
  return `Match ${week} (dev mock)`;
}

/** Strength bias from locked preseason rank (higher = stronger). */
export function strengthFromPreseason(entry: {
  rank: number;
  powerScore: number;
  teamCount: number;
}) {
  return entry.teamCount + 1 - entry.rank + entry.powerScore * 0.15;
}

export type MockTeamSeed = {
  teamId: number;
  name: string;
  abbrev: string;
  logoUrl: string | null;
  ownerName: string | null;
  /** Preseason / draft strength bias (higher = stronger). */
  strength: number;
};

/** Small deterministic PRNG (mulberry32). */
export function createSeededRng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(items: T[], rand: () => number) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

function pairTeams(teamIds: number[], rand: () => number) {
  const ids = shuffleInPlace([...teamIds], rand);
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i + 1 < ids.length; i += 2) {
    pairs.push([ids[i]!, ids[i + 1]!]);
  }
  return pairs;
}

function scoreFor(strength: number, rand: () => number) {
  // Fantasy basketball weekly totals roughly 400–700 area; bias by strength.
  const base = 480 + strength * 18;
  const noise = (rand() - 0.45) * 90;
  return Math.max(320, Math.round((base + noise) * 10) / 10);
}

/**
 * Build weekly H2H results for weeks 1…throughWeek (inclusive).
 */
export function buildMockWeeklyResults(input: {
  teams: MockTeamSeed[];
  throughWeek: number;
  seedKey: string;
}): PowerRankingWeeklyResult[] {
  const byId = new Map(input.teams.map((team) => [team.teamId, team]));
  const teamIds = input.teams.map((team) => team.teamId);
  const results: PowerRankingWeeklyResult[] = [];

  for (let week = 1; week <= input.throughWeek; week++) {
    const rand = createSeededRng(`${input.seedKey}:week:${week}`);
    const pairs = pairTeams(teamIds, rand);
    for (const [homeId, awayId] of pairs) {
      const home = byId.get(homeId)!;
      const away = byId.get(awayId)!;
      let homeScore = scoreFor(home.strength, rand);
      const awayScore = scoreFor(away.strength, rand);
      // Avoid exact ties most of the time for clearer W/L narratives.
      if (homeScore === awayScore) {
        homeScore = Math.round((homeScore + 3.2) * 10) / 10;
      }
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
  }

  return results;
}

export function buildMockScheduleContext(input: {
  teams: MockTeamSeed[];
  throughWeek: number;
  seedKey: string;
  rankByTeamId: Map<number, number>;
}): BlurbScheduleContext {
  const byId = new Map(input.teams.map((team) => [team.teamId, team]));
  const recentResultsByTeam = new Map<number, BlurbCompletedMatchup[]>();
  const upcomingByTeam = new Map<number, BlurbUpcomingMatchup[]>();

  for (let week = 1; week <= input.throughWeek; week++) {
    const rand = createSeededRng(`${input.seedKey}:week:${week}`);
    const pairs = pairTeams(
      input.teams.map((team) => team.teamId),
      rand,
    );
    for (const [homeId, awayId] of pairs) {
      const home = byId.get(homeId)!;
      const away = byId.get(awayId)!;
      let homeScore = scoreFor(home.strength, rand);
      const awayScore = scoreFor(away.strength, rand);
      if (homeScore === awayScore) {
        homeScore = Math.round((homeScore + 3.2) * 10) / 10;
      }

      const pushRecent = (
        teamId: number,
        opponent: MockTeamSeed,
        score: number,
        opponentScore: number,
      ) => {
        const margin = score - opponentScore;
        const row: BlurbCompletedMatchup = {
          matchupPeriodId: week,
          opponentTeamId: opponent.teamId,
          opponentName: opponent.name,
          opponentAbbrev: opponent.abbrev,
          opponentRank: input.rankByTeamId.get(opponent.teamId) ?? null,
          score,
          opponentScore,
          margin,
          result: margin > 0 ? "W" : margin < 0 ? "L" : "T",
        };
        const list = recentResultsByTeam.get(teamId) ?? [];
        list.push(row);
        recentResultsByTeam.set(teamId, list);
      };

      pushRecent(homeId, away, homeScore, awayScore);
      pushRecent(awayId, home, awayScore, homeScore);
    }
  }

  const nextWeek = input.throughWeek + 1;
  const randNext = createSeededRng(`${input.seedKey}:week:${nextWeek}`);
  const nextPairs = pairTeams(
    input.teams.map((team) => team.teamId),
    randNext,
  );
  for (const [homeId, awayId] of nextPairs) {
    const home = byId.get(homeId)!;
    const away = byId.get(awayId)!;
    const pushUpcoming = (teamId: number, opponent: MockTeamSeed) => {
      const row: BlurbUpcomingMatchup = {
        matchupPeriodId: nextWeek,
        opponentTeamId: opponent.teamId,
        opponentName: opponent.name,
        opponentAbbrev: opponent.abbrev,
        opponentRank: input.rankByTeamId.get(opponent.teamId) ?? null,
      };
      const list = upcomingByTeam.get(teamId) ?? [];
      list.push(row);
      upcomingByTeam.set(teamId, list);
    };
    pushUpcoming(homeId, away);
    pushUpcoming(awayId, home);
  }

  for (const [teamId, rows] of recentResultsByTeam) {
    rows.sort((a, b) => b.matchupPeriodId - a.matchupPeriodId);
    recentResultsByTeam.set(teamId, rows.slice(0, 6));
  }

  return { recentResultsByTeam, upcomingByTeam };
}

export type MockMatchSnapshotTeam = {
  teamId: number;
  name: string;
  abbrev: string;
  logoUrl: string | null;
  ownerName: string | null;
  rank: number;
  powerScore: number;
  dominance: number;
  avgScore: number;
  avgMov: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
};

/**
 * Compute a locked Match N snapshot from deterministic fake weeks 1…N.
 */
export function computeMockMatchSnapshot(input: {
  teams: MockTeamSeed[];
  throughWeek: number;
  seedKey: string;
}): MockMatchSnapshotTeam[] {
  const results = buildMockWeeklyResults(input);
  const computed = computePowerRankings(
    input.teams.map((team) => ({ teamId: team.teamId })),
    results,
  );
  const computedById = new Map(computed.map((row) => [row.teamId, row]));

  const recordById = new Map<
    number,
    { wins: number; losses: number; ties: number; pf: number; pa: number }
  >();
  for (const team of input.teams) {
    recordById.set(team.teamId, {
      wins: 0,
      losses: 0,
      ties: 0,
      pf: 0,
      pa: 0,
    });
  }
  for (const result of results) {
    const row = recordById.get(result.teamId);
    if (!row) continue;
    row.pf += result.score;
    row.pa += result.score - result.mov;
    if (result.mov > 0) row.wins += 1;
    else if (result.mov < 0) row.losses += 1;
    else row.ties += 1;
  }

  return input.teams
    .map((team) => {
      const power = computedById.get(team.teamId);
      const record = recordById.get(team.teamId)!;
      return {
        teamId: team.teamId,
        name: team.name,
        abbrev: team.abbrev,
        logoUrl: team.logoUrl,
        ownerName: team.ownerName,
        rank: power?.rank ?? input.teams.length,
        powerScore: power?.powerScore ?? 0,
        dominance: power?.dominance ?? 0,
        avgScore: power?.avgScore ?? 0,
        avgMov: power?.avgMov ?? 0,
        wins: record.wins,
        losses: record.losses,
        ties: record.ties,
        pointsFor: Number(record.pf.toFixed(1)),
        pointsAgainst: Number(record.pa.toFixed(1)),
      };
    })
    .sort((a, b) => a.rank - b.rank);
}
