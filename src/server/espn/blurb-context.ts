import "server-only";

import {
  buildMemberMap,
  buildTeamMap,
  fetchEspnLeague,
  fetchPlayerProjections,
  isCategoryScoring,
  sideMatchupScore,
  type EspnCredentials,
  type EspnLeagueResponse,
  type EspnRosterEntry,
  type EspnScheduleEntry,
  type EspnScheduleSide,
  type EspnTeam,
} from "@/server/espn/shared";

export type EspnBlurbCompletedMatchup = {
  matchupPeriodId: number;
  opponentTeamId: number;
  opponentName: string;
  opponentAbbrev: string;
  opponentRank: number | null;
  score: number;
  opponentScore: number;
  margin: number;
  result: "W" | "L" | "T";
};

export type EspnBlurbUpcomingMatchup = {
  matchupPeriodId: number;
  opponentTeamId: number;
  opponentName: string;
  opponentAbbrev: string;
  opponentRank: number | null;
};

export type EspnBlurbScheduleContext = {
  recentResultsByTeam: Map<number, EspnBlurbCompletedMatchup[]>;
  upcomingByTeam: Map<number, EspnBlurbUpcomingMatchup[]>;
};

/**
 * Completed + upcoming H2H slate context for power-ranking write-ups.
 * `throughMatchupPeriod` is the last locked match week; upcoming starts after it.
 */
export async function fetchEspnBlurbScheduleContext(
  leagueId: number,
  seasonYear: number,
  throughMatchupPeriod: number,
  rankByTeamId: Map<number, number>,
  credentials?: EspnCredentials,
): Promise<EspnBlurbScheduleContext> {
  const data = await fetchEspnLeague(
    leagueId,
    seasonYear,
    ["mSettings", "mTeam", "mMatchupScore"],
    credentials,
  );

  const scoringType = data.settings?.scoringSettings?.scoringType ?? null;
  const categoryLeague = isCategoryScoring(scoringType);
  const memberMap = buildMemberMap(data.members ?? []);
  const teamMap = buildTeamMap(data.teams ?? [], memberMap);

  const recentResultsByTeam = new Map<number, EspnBlurbCompletedMatchup[]>();
  const upcomingByTeam = new Map<number, EspnBlurbUpcomingMatchup[]>();

  const pushRecent = (teamId: number, row: EspnBlurbCompletedMatchup) => {
    const list = recentResultsByTeam.get(teamId) ?? [];
    list.push(row);
    recentResultsByTeam.set(teamId, list);
  };

  const pushUpcoming = (teamId: number, row: EspnBlurbUpcomingMatchup) => {
    const list = upcomingByTeam.get(teamId) ?? [];
    list.push(row);
    upcomingByTeam.set(teamId, list);
  };

  for (const entry of data.schedule ?? []) {
    const period = entry.matchupPeriodId;
    if (typeof period !== "number" || period < 1) continue;

    const homeId = entry.home?.teamId;
    const awayId = entry.away?.teamId;
    if (typeof homeId !== "number" || typeof awayId !== "number") continue;

    const homeInfo = teamMap.get(homeId);
    const awayInfo = teamMap.get(awayId);
    if (!homeInfo || !awayInfo) continue;

    if (period <= throughMatchupPeriod) {
      const homeScore = sideMatchupScore(entry.home, categoryLeague);
      const awayScore = sideMatchupScore(entry.away, categoryLeague);
      if (homeScore == null || awayScore == null) continue;

      const homeResult: "W" | "L" | "T" =
        homeScore > awayScore ? "W" : homeScore < awayScore ? "L" : "T";
      const awayResult: "W" | "L" | "T" =
        awayScore > homeScore ? "W" : awayScore < homeScore ? "L" : "T";

      pushRecent(homeId, {
        matchupPeriodId: period,
        opponentTeamId: awayId,
        opponentName: awayInfo.name,
        opponentAbbrev: awayInfo.abbrev,
        opponentRank: rankByTeamId.get(awayId) ?? null,
        score: homeScore,
        opponentScore: awayScore,
        margin: homeScore - awayScore,
        result: homeResult,
      });
      pushRecent(awayId, {
        matchupPeriodId: period,
        opponentTeamId: homeId,
        opponentName: homeInfo.name,
        opponentAbbrev: homeInfo.abbrev,
        opponentRank: rankByTeamId.get(homeId) ?? null,
        score: awayScore,
        opponentScore: homeScore,
        margin: awayScore - homeScore,
        result: awayResult,
      });
      continue;
    }

    // Upcoming / not-yet-locked periods after this edition's cutoff.
    pushUpcoming(homeId, {
      matchupPeriodId: period,
      opponentTeamId: awayId,
      opponentName: awayInfo.name,
      opponentAbbrev: awayInfo.abbrev,
      opponentRank: rankByTeamId.get(awayId) ?? null,
    });
    pushUpcoming(awayId, {
      matchupPeriodId: period,
      opponentTeamId: homeId,
      opponentName: homeInfo.name,
      opponentAbbrev: homeInfo.abbrev,
      opponentRank: rankByTeamId.get(homeId) ?? null,
    });
  }

  for (const [teamId, rows] of recentResultsByTeam) {
    rows.sort((a, b) => b.matchupPeriodId - a.matchupPeriodId);
    recentResultsByTeam.set(teamId, rows.slice(0, 6));
  }
  for (const [teamId, rows] of upcomingByTeam) {
    rows.sort((a, b) => a.matchupPeriodId - b.matchupPeriodId);
    upcomingByTeam.set(teamId, rows.slice(0, 4));
  }

  return { recentResultsByTeam, upcomingByTeam };
}

/** ESPN FBA defaultPositionId → primary position label. */
const FBA_DEFAULT_POSITION: Record<number, string> = {
  1: "PG",
  2: "SG",
  3: "SF",
  4: "PF",
  5: "C",
};

const POSITION_GROUPS = ["PG", "SG", "SF", "PF", "C"] as const;

function rosterProjectedSeasonTotal(
  stats:
    | Array<{
        id?: string;
        statSourceId?: number;
        statSplitTypeId?: number;
        appliedTotal?: number;
      }>
    | undefined,
  seasonYear: number,
) {
  const list = stats ?? [];
  const projected = list.find(
    (stat) =>
      stat.statSourceId === 1 &&
      stat.statSplitTypeId === 0 &&
      (stat.id === `10${seasonYear}` || Boolean(stat.id?.startsWith("10"))),
  );
  if (
    typeof projected?.appliedTotal === "number" &&
    projected.appliedTotal > 0
  ) {
    return projected.appliedTotal;
  }
  const prior = list.find(
    (stat) =>
      stat.statSourceId === 0 &&
      stat.statSplitTypeId === 0 &&
      typeof stat.appliedTotal === "number" &&
      stat.appliedTotal > 100,
  );
  return prior?.appliedTotal ?? null;
}

/** Map ESPN injury enums to short labels for write-ups (e.g. DAY_TO_DAY → DTD). */
function normalizeInjuryStatus(status: string | undefined | null) {
  if (!status) return null;
  const normalized = status
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!normalized || normalized === "ACTIVE") return null;

  const labels: Record<string, string> = {
    DAY_TO_DAY: "DTD",
    OUT: "OUT",
    INJURY_RESERVE: "IR",
    IR: "IR",
    QUESTIONABLE: "Q",
    DOUBTFUL: "D",
    PROBABLE: "P",
    SUSPENSION: "SUSP",
    SUSPENDED: "SUSP",
  };

  return labels[normalized] ?? normalized.replaceAll("_", " ");
}

export type EspnBlurbRosterPlayer = {
  name: string;
  position: string;
  projectedPpg: number | null;
  injuryStatus: string | null;
  slot: "starter" | "bench" | "ir";
};

export type EspnBlurbPositionGroup = {
  position: string;
  playerCount: number;
  projectedPpgTotal: number;
  leagueRank: number;
};

export type EspnBlurbPositionHighlight = {
  position: string;
  leagueRank: number;
  projectedPpgTotal: number;
};

export type EspnBlurbTeamRoster = {
  draftDayProjectedRank: number | null;
  /** Top two projected players (name + projected fantasy PPG). */
  headliners: EspnBlurbRosterPlayer[];
  topPlayers: EspnBlurbRosterPlayer[];
  /** Meaningful absences: OUT / IR / SUSP / doubtful. */
  injuredPlayers: EspnBlurbRosterPlayer[];
  /** Soft statuses (DTD / Q / P) — usually not a big deal. */
  dayToDayPlayers: EspnBlurbRosterPlayer[];
  positionGroups: EspnBlurbPositionGroup[];
  /** Best projected-depth position vs the league (e.g. 1st in C). */
  bestPosition: EspnBlurbPositionHighlight | null;
  /** Weakest projected-depth position vs the league (e.g. 11th at PG). */
  worstPosition: EspnBlurbPositionHighlight | null;
};

/**
 * Roster texture for write-ups: projected scorers, injuries, position strength.
 */
export async function fetchEspnBlurbRosterContext(
  leagueId: number,
  seasonYear: number,
  credentials?: EspnCredentials,
): Promise<Map<number, EspnBlurbTeamRoster>> {
  const data = await fetchEspnLeague(
    leagueId,
    seasonYear,
    ["mTeam", "mRoster"],
    credentials,
  );

  type RawPlayer = EspnBlurbRosterPlayer & { projectedSeasonTotal: number };

  const rawByTeam = new Map<
    number,
    {
      draftDayProjectedRank: number | null;
      players: RawPlayer[];
    }
  >();

  for (const team of data.teams ?? []) {
    if (typeof team.id !== "number") continue;
    const players: RawPlayer[] = [];

    for (const entry of team.roster?.entries ?? []) {
      const player = entry.playerPoolEntry?.player;
      const name = player?.fullName?.trim();
      if (!name) continue;

      const slotId = entry.lineupSlotId;
      const slot: EspnBlurbRosterPlayer["slot"] =
        slotId === 13 ? "ir" : slotId === 12 ? "bench" : "starter";
      const position =
        FBA_DEFAULT_POSITION[player?.defaultPositionId ?? -1] ?? "UTIL";
      const seasonTotal = rosterProjectedSeasonTotal(player?.stats, seasonYear);
      const projectedPpg =
        seasonTotal != null ? Number((seasonTotal / 82).toFixed(1)) : null;
      const injuryStatus = normalizeInjuryStatus(
        player?.injuryStatus ?? entry.injuryStatus,
      );

      players.push({
        name,
        position,
        projectedPpg,
        injuryStatus,
        slot,
        projectedSeasonTotal: seasonTotal ?? 0,
      });
    }

    rawByTeam.set(team.id, {
      draftDayProjectedRank:
        typeof team.draftDayProjectedRank === "number" &&
        team.draftDayProjectedRank > 0
          ? team.draftDayProjectedRank
          : null,
      players,
    });
  }

  // League-wide projected PPG totals by position for relative ranks.
  const positionTotalsByTeam = new Map<number, Map<string, number>>();
  for (const [teamId, raw] of rawByTeam) {
    const totals = new Map<string, number>();
    for (const position of POSITION_GROUPS) totals.set(position, 0);
    for (const player of raw.players) {
      if (
        !POSITION_GROUPS.includes(
          player.position as (typeof POSITION_GROUPS)[number],
        )
      ) {
        continue;
      }
      totals.set(
        player.position,
        (totals.get(player.position) ?? 0) + (player.projectedPpg ?? 0),
      );
    }
    positionTotalsByTeam.set(teamId, totals);
  }

  const leaguePositionLists = new Map<string, number[]>();
  for (const position of POSITION_GROUPS) {
    const values: number[] = [];
    for (const totals of positionTotalsByTeam.values()) {
      values.push(totals.get(position) ?? 0);
    }
    leaguePositionLists.set(position, values);
  }

  const SERIOUS_INJURY = new Set(["OUT", "IR", "SUSP", "D"]);
  const SOFT_INJURY = new Set(["DTD", "Q", "P"]);

  const result = new Map<number, EspnBlurbTeamRoster>();

  for (const [teamId, raw] of rawByTeam) {
    const sorted = [...raw.players].sort(
      (a, b) => b.projectedSeasonTotal - a.projectedSeasonTotal,
    );
    const strip = ({ projectedSeasonTotal: _, ...player }: RawPlayer) => player;
    const topPlayers = sorted.slice(0, 5).map(strip);
    const headliners = topPlayers.slice(0, 2);
    const injuredPlayers = sorted
      .filter(
        (player) =>
          player.injuryStatus != null &&
          SERIOUS_INJURY.has(player.injuryStatus),
      )
      .slice(0, 6)
      .map(strip);
    const dayToDayPlayers = sorted
      .filter(
        (player) =>
          player.injuryStatus != null && SOFT_INJURY.has(player.injuryStatus),
      )
      .slice(0, 6)
      .map(strip);

    const totals =
      positionTotalsByTeam.get(teamId) ?? new Map<string, number>();
    const counts = new Map<string, number>();
    for (const position of POSITION_GROUPS) counts.set(position, 0);
    for (const player of raw.players) {
      if (
        !POSITION_GROUPS.includes(
          player.position as (typeof POSITION_GROUPS)[number],
        )
      ) {
        continue;
      }
      counts.set(player.position, (counts.get(player.position) ?? 0) + 1);
    }

    const positionGroups: EspnBlurbPositionGroup[] = POSITION_GROUPS.map(
      (position) => {
        const projectedPpgTotal = Number(
          (totals.get(position) ?? 0).toFixed(1),
        );
        const leagueValues = leaguePositionLists.get(position) ?? [];
        const sortedDesc = [...leagueValues].sort((a, b) => b - a);
        const leagueRank = sortedDesc.indexOf(totals.get(position) ?? 0) + 1;
        return {
          position,
          playerCount: counts.get(position) ?? 0,
          projectedPpgTotal,
          leagueRank: leagueRank > 0 ? leagueRank : leagueValues.length,
        };
      },
    );

    const withProduction = positionGroups.filter(
      (group) => group.projectedPpgTotal > 0 || group.playerCount > 0,
    );
    const byBestRank = [...withProduction].sort(
      (a, b) =>
        a.leagueRank - b.leagueRank ||
        b.projectedPpgTotal - a.projectedPpgTotal,
    );
    const byWorstRank = [...withProduction].sort(
      (a, b) =>
        b.leagueRank - a.leagueRank ||
        a.projectedPpgTotal - b.projectedPpgTotal,
    );
    const best = byBestRank[0];
    const worst = byWorstRank[0];

    result.set(teamId, {
      draftDayProjectedRank: raw.draftDayProjectedRank,
      headliners,
      topPlayers,
      injuredPlayers,
      dayToDayPlayers,
      positionGroups,
      bestPosition: best
        ? {
            position: best.position,
            leagueRank: best.leagueRank,
            projectedPpgTotal: best.projectedPpgTotal,
          }
        : null,
      worstPosition: worst
        ? {
            position: worst.position,
            leagueRank: worst.leagueRank,
            projectedPpgTotal: worst.projectedPpgTotal,
          }
        : null,
    });
  }

  return result;
}
