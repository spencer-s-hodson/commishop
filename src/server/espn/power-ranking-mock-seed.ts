import "server-only";

import { and, asc, eq, gte } from "drizzle-orm";

import { db } from "@/server/db";
import {
  fantasyLeague,
  powerRankingEdition,
  powerRankingEntry,
} from "@/server/db/schema";
import { fetchEspnBlurbRosterContext } from "@/server/espn/blurb-context";
import type { EspnCredentials } from "@/server/espn/shared";
import { buildPowerRankingBlurbRequest } from "@/server/espn/power-ranking-blurb-prompt";
import { generatePowerRankingBlurbs } from "@/server/espn/power-ranking-blurbs";
import {
  buildMockScheduleContext,
  computeMockMatchSnapshot,
  mockEditionLabel,
  mockMatchupPeriodId,
  strengthFromPreseason,
  type MockTeamSeed,
  MOCK_MATCHUP_PERIOD_BASE,
} from "@/server/espn/power-ranking-mock";

function credentialsFor(league: {
  espnS2: string | null;
  swid: string | null;
}): EspnCredentials {
  return { espnS2: league.espnS2, swid: league.swid };
}

async function getPreseasonEntries(fantasyLeagueId: string) {
  const preseason = await db.query.powerRankingEdition.findFirst({
    where: and(
      eq(powerRankingEdition.fantasyLeagueId, fantasyLeagueId),
      eq(powerRankingEdition.kind, "preseason"),
    ),
    with: {
      entries: {
        orderBy: [asc(powerRankingEntry.rank)],
      },
    },
  });
  return preseason;
}

async function deleteExistingMocks(fantasyLeagueId: string) {
  const mocks = await db.query.powerRankingEdition.findMany({
    where: and(
      eq(powerRankingEdition.fantasyLeagueId, fantasyLeagueId),
      gte(powerRankingEdition.matchupPeriodId, MOCK_MATCHUP_PERIOD_BASE),
    ),
  });
  for (const edition of mocks) {
    await db
      .delete(powerRankingEntry)
      .where(eq(powerRankingEntry.editionId, edition.id));
    await db
      .delete(powerRankingEdition)
      .where(eq(powerRankingEdition.id, edition.id));
  }
  return mocks.length;
}

async function writeMockEdition(input: {
  league: typeof fantasyLeague.$inferSelect;
  week: number;
  seeds: MockTeamSeed[];
  seedKey: string;
  previousRanks: Map<number, number>;
}) {
  const snapshot = computeMockMatchSnapshot({
    teams: input.seeds,
    throughWeek: input.week,
    seedKey: input.seedKey,
  });
  const rankByTeamId = new Map(
    snapshot.map((team) => [team.teamId, team.rank]),
  );
  const schedule = buildMockScheduleContext({
    teams: input.seeds,
    throughWeek: input.week,
    seedKey: input.seedKey,
    rankByTeamId,
  });

  let rosterByTeam = null;
  try {
    rosterByTeam = await fetchEspnBlurbRosterContext(
      input.league.espnLeagueId,
      input.league.seasonYear,
      credentialsFor(input.league),
    );
  } catch (error) {
    console.warn("[mock-power-rankings] roster context unavailable:", error);
  }

  const editionId = crypto.randomUUID();
  const matchupPeriodId = mockMatchupPeriodId(input.week);
  const label = mockEditionLabel(input.week);

  await db.insert(powerRankingEdition).values({
    id: editionId,
    fantasyLeagueId: input.league.id,
    seasonYear: input.league.seasonYear,
    kind: "match",
    matchupPeriodId,
    label,
    throughMatchupPeriod: input.week,
    publishedAt: new Date(),
  });

  await db.insert(powerRankingEntry).values(
    snapshot.map((team) => ({
      id: crypto.randomUUID(),
      editionId,
      teamId: team.teamId,
      rank: team.rank,
      previousRank: input.previousRanks.get(team.teamId) ?? null,
      powerScore: team.powerScore,
      dominance: team.sos,
      avgScore: team.avgScore,
      avgMov: team.avgMov,
      wins: team.wins,
      losses: team.losses,
      ties: team.ties,
      pointsFor: team.pointsFor,
      pointsAgainst: team.pointsAgainst,
      name: team.name,
      abbrev: team.abbrev,
      logoUrl: team.logoUrl,
      ownerName: team.ownerName,
      blurb: null,
    })),
  );

  const request = buildPowerRankingBlurbRequest({
    leagueName: input.league.name,
    seasonYear: input.league.seasonYear,
    editionLabel: label,
    kind: "match",
    throughMatchupPeriod: input.week,
    entries: snapshot.map((team) => ({
      teamId: team.teamId,
      rank: team.rank,
      previousRank: input.previousRanks.get(team.teamId) ?? null,
      name: team.name,
      abbrev: team.abbrev,
      ownerName: team.ownerName,
      powerScore: team.powerScore,
      wins: team.wins,
      losses: team.losses,
      ties: team.ties,
      pointsFor: team.pointsFor,
      pointsAgainst: team.pointsAgainst,
      avgScore: team.avgScore,
      avgMov: team.avgMov,
      sos: team.sos,
    })),
    schedule,
    rosterByTeam,
  });

  const blurbs = await generatePowerRankingBlurbs(request);
  // Models sometimes omit teams or miss the sentence window — retry once for gaps.
  if (blurbs.size < snapshot.length) {
    const retry = await generatePowerRankingBlurbs(request);
    for (const [teamId, blurb] of retry) {
      if (!blurbs.has(teamId)) blurbs.set(teamId, blurb);
    }
  }

  const entries = await db.query.powerRankingEntry.findMany({
    where: eq(powerRankingEntry.editionId, editionId),
  });
  let written = 0;
  for (const entry of entries) {
    const blurb = blurbs.get(entry.teamId);
    if (!blurb) continue;
    await db
      .update(powerRankingEntry)
      .set({ blurb })
      .where(eq(powerRankingEntry.id, entry.id));
    written += 1;
  }

  return {
    editionId,
    label,
    matchupPeriodId,
    teams: snapshot.length,
    blurbsWritten: written,
    ranks: snapshot.map((team) => ({
      rank: team.rank,
      previousRank: input.previousRanks.get(team.teamId) ?? null,
      name: team.name,
      record: `${team.wins}-${team.losses}`,
      pointsFor: team.pointsFor,
    })),
  };
}

/**
 * Replace any prior mock editions with Match 1–N (dev mock), default N=5.
 * Uses real preseason roster identities; invents deterministic H2H results.
 */
export async function seedMockPowerRankingWeeks(options?: {
  fantasyLeagueId?: string;
  weeks?: number;
}) {
  const weeks = Math.min(5, Math.max(1, options?.weeks ?? 5));
  const league = options?.fantasyLeagueId
    ? await db.query.fantasyLeague.findFirst({
        where: eq(fantasyLeague.id, options.fantasyLeagueId),
      })
    : await db.query.fantasyLeague.findFirst();

  if (!league) {
    throw new Error("No fantasy league found to seed mocks against.");
  }

  const preseason = await getPreseasonEntries(league.id);
  if (!preseason || preseason.entries.length === 0) {
    throw new Error(
      "Preseason edition missing — open Power Rankings once to create it first.",
    );
  }

  const deleted = await deleteExistingMocks(league.id);
  const teamCount = preseason.entries.length;
  const seeds: MockTeamSeed[] = preseason.entries.map((entry) => ({
    teamId: entry.teamId,
    name: entry.name,
    abbrev: entry.abbrev,
    logoUrl: entry.logoUrl,
    ownerName: entry.ownerName,
    strength: strengthFromPreseason({
      rank: entry.rank,
      powerScore: entry.powerScore,
      teamCount,
    }),
  }));

  const seedKey = `${league.id}:mock-power:chaos-v1`;
  const editions = [];

  let previousRanks = new Map(
    preseason.entries.map((entry) => [entry.teamId, entry.rank]),
  );

  for (let week = 1; week <= weeks; week++) {
    const edition = await writeMockEdition({
      league,
      week,
      seeds,
      seedKey,
      previousRanks,
    });
    editions.push(edition);
    previousRanks = new Map(
      (
        await db.query.powerRankingEntry.findMany({
          where: eq(powerRankingEntry.editionId, edition.editionId),
          columns: { teamId: true, rank: true },
        })
      ).map((entry) => [entry.teamId, entry.rank]),
    );
  }

  return {
    fantasyLeagueId: league.id,
    leagueName: league.name,
    deletedMockEditions: deleted,
    editions,
  };
}
