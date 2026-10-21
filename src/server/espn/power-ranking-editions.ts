import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/server/db";
import {
  powerRankingEdition,
  powerRankingEntry,
} from "@/server/db/schema";
import {
  fetchEspnBlurbRosterContext,
  fetchEspnBlurbScheduleContext,
  fetchEspnDraftDayRankings,
  fetchEspnMatchupPeriodOptions,
  fetchEspnPowerRankings,
  type EspnCredentials,
} from "@/server/espn/client";
import {
  buildPowerRankingBlurbRequest,
  generatePowerRankingBlurbs,
} from "@/server/espn/power-ranking-blurbs";
import {
  buildMockScheduleContext,
  isMockMatchupPeriod,
  strengthFromPreseason,
} from "@/server/espn/power-ranking-mock";

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

    let schedule = null;
    if (kind === "match" && edition.throughMatchupPeriod > 0) {
      if (isMockMatchupPeriod(edition.matchupPeriodId)) {
        // Rebuild the same deterministic slate the mock seed used.
        const preseason = await findPreseasonEdition(league.id);
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
            : edition.entries.length;
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
        schedule = buildMockScheduleContext({
          teams: edition.entries.map((entry) => ({
            teamId: entry.teamId,
            name: entry.name,
            abbrev: entry.abbrev,
            logoUrl: entry.logoUrl,
            ownerName: entry.ownerName,
            strength:
              strengthByTeamId.get(entry.teamId) ??
              teamCount + 1 - entry.rank,
          })),
          throughWeek: edition.throughMatchupPeriod,
          seedKey: `${league.id}:mock-power`,
          rankByTeamId,
        });
      } else {
        schedule = await fetchEspnBlurbScheduleContext(
          league.espnLeagueId,
          league.seasonYear,
          edition.throughMatchupPeriod,
          rankByTeamId,
          credentialsFor(league),
        );
      }
    }

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
      powerScore: Math.max(0, draft.teams.length + 1 - team.draftDayProjectedRank),
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

const DENVER_TZ = "America/Denver";

/** Calendar YYYY-MM-DD in America/Denver. */
export function denverYmd(date: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DENVER_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Hour 0–23 in America/Denver. */
export function denverHour(date: Date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: DENVER_TZ,
      hour: "numeric",
      hour12: false,
    }).format(date),
  );
  // en-US hour12:false can yield "24" for midnight in some engines
  return hour === 24 ? 0 : hour;
}

/** Yesterday's calendar date in America/Denver (YYYY-MM-DD). */
export function denverYesterdayYmd(date: Date = new Date()) {
  const today = denverYmd(date);
  const [y, m, d] = today.split("-").map(Number);
  // Calendar arithmetic on Denver's Y-M-D (avoid DST edge cases).
  const yesterday = new Date(Date.UTC(y!, m! - 1, d! - 1));
  const yy = yesterday.getUTCFullYear();
  const mm = String(yesterday.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(yesterday.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Publish Match N editions for leagues where yesterday (Denver) equals a
 * matchup period's ESPN endDate. Also ensures preseason exists.
 */
export async function runPowerRankingPublishJob(options?: {
  /** Override "now" for tests. */
  now?: Date;
  /** Force run even when Denver hour is not 10. */
  force?: boolean;
}) {
  const now = options?.now ?? new Date();
  const hour = denverHour(now);
  if (!options?.force && hour !== 10) {
    return {
      skipped: true as const,
      reason: `Denver hour is ${hour}, expected 10`,
      published: [] as Array<{
        fantasyLeagueId: string;
        matchupPeriodId: number;
        label: string;
      }>,
    };
  }

  const yesterday = denverYesterdayYmd(now);
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

      for (const option of optionsList) {
        if (option.endDate !== yesterday) continue;
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
      console.error(
        `[power-rankings cron] league ${league.id} failed:`,
        error,
      );
    }
  }

  return {
    skipped: false as const,
    yesterday,
    published,
  };
}
