import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { powerRankingEdition, powerRankingEntry } from "@/server/db/schema";
import { fetchEspnBlurbRosterContext } from "@/server/espn/blurb-context";
import {
  fetchEspnDraftDayRankings,
  fetchEspnMatchupPeriodOptions,
  fetchEspnPowerRankings,
} from "@/server/espn/power-feed";
import type { EspnCredentials } from "@/server/espn/shared";
import { buildPowerRankingBlurbRequest } from "@/server/espn/power-ranking-blurb-prompt";
import { resolveBlurbScheduleContext } from "@/server/espn/power-ranking-blurb-schedule";
import { generatePowerRankingBlurbs } from "@/server/espn/power-ranking-blurbs";
import {
  evaluatePublishHourGate,
  matchupsEndingOn,
} from "@/server/espn/power-ranking-publish-policy";

export type ConnectedLeagueRow = {
  id: string;
  espnLeagueId: number;
  seasonYear: number;
  name: string;
  espnS2: string | null;
  swid: string | null;
};

function credentialsFor(league: ConnectedLeagueRow): EspnCredentials {
  return { espnS2: league.espnS2, swid: league.swid };
}

function editionSortKey(edition: {
  kind: string;
  matchupPeriodId: number | null;
}) {
  if (edition.kind === "preseason") return 0;
  return edition.matchupPeriodId ?? 0;
}

/** List published editions oldest → newest (Preseason, Match 1, …). */
export async function listPowerRankingEditions(fantasyLeagueId: string) {
  const editions = await db.query.powerRankingEdition.findMany({
    where: eq(powerRankingEdition.fantasyLeagueId, fantasyLeagueId),
  });

  return editions.sort((a, b) => editionSortKey(a) - editionSortKey(b));
}

export async function getLatestPowerRankingEdition(fantasyLeagueId: string) {
  const editions = await listPowerRankingEditions(fantasyLeagueId);
  return editions.at(-1) ?? null;
}

export async function getPowerRankingEditionById(
  fantasyLeagueId: string,
  editionId: string,
) {
  return db.query.powerRankingEdition.findFirst({
    where: and(
      eq(powerRankingEdition.id, editionId),
      eq(powerRankingEdition.fantasyLeagueId, fantasyLeagueId),
    ),
    with: {
      entries: {
        orderBy: [asc(powerRankingEntry.rank)],
      },
    },
  });
}

async function findPreseasonEdition(fantasyLeagueId: string) {
  return db.query.powerRankingEdition.findFirst({
    where: and(
      eq(powerRankingEdition.fantasyLeagueId, fantasyLeagueId),
      eq(powerRankingEdition.kind, "preseason"),
      eq(powerRankingEdition.matchupPeriodId, 0),
    ),
  });
}

async function findMatchEdition(
  fantasyLeagueId: string,
  matchupPeriodId: number,
) {
  return db.query.powerRankingEdition.findFirst({
    where: and(
      eq(powerRankingEdition.fantasyLeagueId, fantasyLeagueId),
      eq(powerRankingEdition.kind, "match"),
      eq(powerRankingEdition.matchupPeriodId, matchupPeriodId),
    ),
  });
}

async function previousEditionRanks(fantasyLeagueId: string) {
  const latest = await getLatestPowerRankingEdition(fantasyLeagueId);
  if (!latest) return new Map<number, number>();

  const entries = await db.query.powerRankingEntry.findMany({
    where: eq(powerRankingEntry.editionId, latest.id),
    columns: { teamId: true, rank: true },
  });

  return new Map(entries.map((entry) => [entry.teamId, entry.rank]));
}

/**
 * Fill missing blurbs for an edition (idempotent). Safe to call on read / cron.
 */
export async function ensureEditionBlurbs(editionId: string) {
  const edition = await db.query.powerRankingEdition.findFirst({
    where: eq(powerRankingEdition.id, editionId),
    with: {
      fantasyLeague: true,
      entries: {
        orderBy: [asc(powerRankingEntry.rank)],
      },
    },
  });
  if (!edition) return;

  const missing = edition.entries.filter(
    (entry) => !entry.blurb || entry.blurb.trim().length === 0,
  );
  if (missing.length === 0) return;

  const kind = edition.kind === "match" ? "match" : "preseason";
  const league = edition.fantasyLeague;

  try {
    const rankByTeamId = new Map(
      edition.entries.map((entry) => [entry.teamId, entry.rank]),
    );

    const schedule = await resolveBlurbScheduleContext({
      league,
      kind,
      matchupPeriodId: edition.matchupPeriodId,
      throughMatchupPeriod: edition.throughMatchupPeriod,
      entries: edition.entries,
      rankByTeamId,
    });

    let rosterByTeam = null;
    try {
      rosterByTeam = await fetchEspnBlurbRosterContext(
        league.espnLeagueId,
        league.seasonYear,
        credentialsFor(league),
      );
    } catch (error) {
      console.warn(
        `[power-rankings] roster context unavailable for edition ${editionId}:`,
        error,
      );
    }

    const request = buildPowerRankingBlurbRequest({
      leagueName: league.name,
      seasonYear: league.seasonYear,
      editionLabel: edition.label,
      kind,
      throughMatchupPeriod: edition.throughMatchupPeriod,
      entries: edition.entries.map((entry) => ({
        teamId: entry.teamId,
        rank: entry.rank,
        previousRank: entry.previousRank,
        name: entry.name,
        abbrev: entry.abbrev,
        ownerName: entry.ownerName,
        powerScore: entry.powerScore,
        wins: entry.wins,
        losses: entry.losses,
        ties: entry.ties,
        pointsFor: entry.pointsFor,
        pointsAgainst: entry.pointsAgainst,
        avgScore: entry.avgScore,
        avgMov: entry.avgMov,
        dominance: entry.dominance,
      })),
      schedule,
      rosterByTeam,
    });

    const blurbs = await generatePowerRankingBlurbs(request);

    for (const entry of missing) {
      const blurb = blurbs.get(entry.teamId);
      if (!blurb) continue;
      await db
        .update(powerRankingEntry)
        .set({ blurb })
        .where(eq(powerRankingEntry.id, entry.id));
    }
  } catch (error) {
    console.error(
      `[power-rankings] blurb generation failed for edition ${editionId}:`,
      error,
    );
  }
}

/**
 * Create the Preseason edition from ESPN draftDayProjectedRank if missing.
 */
export async function ensurePreseasonEdition(league: ConnectedLeagueRow) {
  const existing = await findPreseasonEdition(league.id);
  if (existing) {
    await ensureEditionBlurbs(existing.id);
    return existing;
  }

  const draft = await fetchEspnDraftDayRankings(
    league.espnLeagueId,
    league.seasonYear,
    credentialsFor(league),
  );

  const editionId = crypto.randomUUID();
  const publishedAt = new Date();

  await db.insert(powerRankingEdition).values({
    id: editionId,
    fantasyLeagueId: league.id,
    seasonYear: league.seasonYear,
    kind: "preseason",
    matchupPeriodId: 0,
    label: "Preseason",
    throughMatchupPeriod: 0,
    publishedAt,
  });

  await db.insert(powerRankingEntry).values(
    draft.teams.map((team, index) => ({
      id: crypto.randomUUID(),
      editionId,
      teamId: team.teamId,
      rank: index + 1,
      previousRank: null,
      // Use draft-day rank as a stable score (lower rank → higher inverted score).
      powerScore: Math.max(
        0,
        draft.teams.length + 1 - team.draftDayProjectedRank,
      ),
      dominance: 0,
      avgScore: 0,
      avgMov: 0,
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

  await ensureEditionBlurbs(editionId);

  return (await findPreseasonEdition(league.id))!;
}

/**
 * Lock Match N power rankings (idempotent). Uses formula through that matchup period.
 */
export async function publishMatchEdition(
  league: ConnectedLeagueRow,
  matchupPeriodId: number,
) {
  if (matchupPeriodId < 1) {
    throw new Error("matchupPeriodId must be >= 1");
  }

  await ensurePreseasonEdition(league);

  const existing = await findMatchEdition(league.id, matchupPeriodId);
  if (existing) {
    await ensureEditionBlurbs(existing.id);
    return { edition: existing, created: false as const };
  }

  const priorRanks = await previousEditionRanks(league.id);
  const power = await fetchEspnPowerRankings(
    league.espnLeagueId,
    league.seasonYear,
    credentialsFor(league),
    { throughMatchupPeriod: matchupPeriodId },
  );

  const editionId = crypto.randomUUID();
  const publishedAt = new Date();
  const label = `Match ${matchupPeriodId}`;

  await db.insert(powerRankingEdition).values({
    id: editionId,
    fantasyLeagueId: league.id,
    seasonYear: league.seasonYear,
    kind: "match",
    matchupPeriodId,
    label,
    throughMatchupPeriod: matchupPeriodId,
    publishedAt,
  });

  await db.insert(powerRankingEntry).values(
    power.rankings.map((team) => ({
      id: crypto.randomUUID(),
      editionId,
      teamId: team.teamId,
      rank: team.rank,
      previousRank: priorRanks.get(team.teamId) ?? null,
      powerScore: team.powerScore,
      dominance: team.dominance,
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

  await ensureEditionBlurbs(editionId);

  const edition = await findMatchEdition(league.id, matchupPeriodId);
  return { edition: edition!, created: true as const };
}

/**
 * Daily wake-up check. Publishes Match N only when ESPN's Eastern calendar
 * says a matchup ended yesterday — i.e. 10am Utah the morning after a period
 * ends (weekly, biweekly, etc.).
 *
 * DST: Vercel cron is UTC-only, so vercel.json registers two daily wakes:
 *   - `0 16 * * *` → 10:00–10:59 Utah during MDT
 *   - `0 17 * * *` → 10:00–10:59 Utah during MST
 * The handler only proceeds when Utah local hour is 10 (the off-season wake
 * no-ops). Calendar math uses IANA zones so spring/fall do not skew "yesterday".
 */
export async function runPowerRankingPublishJob(options?: {
  /** Override "now" for tests. */
  now?: Date;
  /** Force run even outside the Utah 10am hour. */
  force?: boolean;
}) {
  const now = options?.now ?? new Date();
  const gate = evaluatePublishHourGate(now, { force: options?.force });
  if (gate.skipped) {
    return {
      skipped: true as const,
      reason: gate.reason,
      published: [] as Array<{
        fantasyLeagueId: string;
        matchupPeriodId: number;
        label: string;
      }>,
    };
  }

  const { yesterday } = gate;
  const leagues = await db.query.fantasyLeague.findMany();
  const published: Array<{
    fantasyLeagueId: string;
    matchupPeriodId: number;
    label: string;
  }> = [];

  for (const league of leagues) {
    try {
      await ensurePreseasonEdition(league);

      const optionsList = await fetchEspnMatchupPeriodOptions(
        league.espnLeagueId,
        league.seasonYear,
        credentialsFor(league),
      );

      for (const option of matchupsEndingOn(optionsList, yesterday)) {
        const result = await publishMatchEdition(
          league,
          option.matchupPeriodId,
        );
        if (result.created) {
          published.push({
            fantasyLeagueId: league.id,
            matchupPeriodId: option.matchupPeriodId,
            label: result.edition.label,
          });
        }
      }
    } catch (error) {
      console.error(`[power-rankings cron] league ${league.id} failed:`, error);
    }
  }

  return {
    skipped: false as const,
    yesterday,
    published,
  };
}
