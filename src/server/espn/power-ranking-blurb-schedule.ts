import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { powerRankingEdition, powerRankingEntry } from "@/server/db/schema";
import {
  fetchEspnBlurbScheduleContext,
  type EspnBlurbScheduleContext,
} from "@/server/espn/blurb-context";
import type { EspnCredentials } from "@/server/espn/shared";
import {
  buildMockScheduleContext,
  isMockMatchupPeriod,
  strengthFromPreseason,
} from "@/server/espn/power-ranking-mock";

type EditionTeamRow = {
  teamId: number;
  rank: number;
  name: string;
  abbrev: string;
  logoUrl: string | null;
  ownerName: string | null;
};

type LeagueRow = {
  id: string;
  espnLeagueId: number;
  seasonYear: number;
  espnS2: string | null;
  swid: string | null;
};

/**
 * Schedule context for blurb generation.
 * Live ESPN for real match editions; deterministic mock adapter for seed weeks.
 */
export async function resolveBlurbScheduleContext(input: {
  league: LeagueRow;
  kind: "preseason" | "match";
  matchupPeriodId: number;
  throughMatchupPeriod: number;
  entries: EditionTeamRow[];
  rankByTeamId: Map<number, number>;
}): Promise<EspnBlurbScheduleContext | null> {
  if (input.kind !== "match" || input.throughMatchupPeriod <= 0) {
    return null;
  }

  if (isMockMatchupPeriod(input.matchupPeriodId)) {
    return resolveMockBlurbSchedule(input);
  }

  const credentials: EspnCredentials = {
    espnS2: input.league.espnS2,
    swid: input.league.swid,
  };

  return fetchEspnBlurbScheduleContext(
    input.league.espnLeagueId,
    input.league.seasonYear,
    input.throughMatchupPeriod,
    input.rankByTeamId,
    credentials,
  );
}

async function resolveMockBlurbSchedule(input: {
  league: LeagueRow;
  throughMatchupPeriod: number;
  entries: EditionTeamRow[];
  rankByTeamId: Map<number, number>;
}): Promise<EspnBlurbScheduleContext> {
  const preseason = await db.query.powerRankingEdition.findFirst({
    where: and(
      eq(powerRankingEdition.fantasyLeagueId, input.league.id),
      eq(powerRankingEdition.kind, "preseason"),
      eq(powerRankingEdition.matchupPeriodId, 0),
    ),
  });

  const preseasonEntries = preseason
    ? await db.query.powerRankingEntry.findMany({
        where: eq(powerRankingEntry.editionId, preseason.id),
        columns: {
          teamId: true,
          rank: true,
          powerScore: true,
        },
      })
    : [];

  const teamCount =
    preseasonEntries.length > 0
      ? preseasonEntries.length
      : input.entries.length;
  const strengthByTeamId = new Map(
    preseasonEntries.map((entry) => [
      entry.teamId,
      strengthFromPreseason({
        rank: entry.rank,
        powerScore: entry.powerScore,
        teamCount,
      }),
    ]),
  );

  return buildMockScheduleContext({
    teams: input.entries.map((entry) => ({
      teamId: entry.teamId,
      name: entry.name,
      abbrev: entry.abbrev,
      logoUrl: entry.logoUrl,
      ownerName: entry.ownerName,
      strength:
        strengthByTeamId.get(entry.teamId) ?? teamCount + 1 - entry.rank,
    })),
    throughWeek: input.throughMatchupPeriod,
    seedKey: `${input.league.id}:mock-power:chaos-v1`,
    rankByTeamId: input.rankByTeamId,
  });
}
