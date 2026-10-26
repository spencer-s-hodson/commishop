import "server-only";

import {
  BENCH_SLOT_ID,
  type TradeLeagueContext,
  type TradePlayer,
  type TradeTeam,
} from "@/lib/trade-analysis";
import { eligibleFantasyPositions } from "@/server/espn/position-strength";
import {
  buildMemberMap,
  buildTeamMap,
  fetchEspnJson,
  fetchEspnLeague,
  fetchProTeamSchedules,
  isCategoryScoring,
  type EspnCredentials,
  type EspnLeagueResponse,
} from "@/server/espn/shared";
import {
  rawTradeValue,
  replacementLevelPpg,
  valuePlayer,
  type EspnStatLine,
} from "@/server/espn/trade-valuation";

const FREE_AGENT_POOL_SIZE = 40;
const FREE_AGENTS_RETURNED = 15;

type EspnTradePlayer = {
  id?: number;
  fullName?: string;
  proTeamId?: number;
  defaultPositionId?: number;
  eligibleSlots?: number[];
  injuryStatus?: string;
  stats?: EspnStatLine[];
};

type EspnTradeLeagueResponse = EspnLeagueResponse & {
  settings?: EspnLeagueResponse["settings"] & {
    rosterSettings?: { lineupSlotCounts?: Record<string, number> };
  };
  status?: EspnLeagueResponse["status"] & { finalScoringPeriod?: number };
  teams?: Array<
    NonNullable<EspnLeagueResponse["teams"]>[number] & {
      roster?: {
        entries?: Array<{
          playerId?: number;
          lineupSlotId?: number;
          injuryStatus?: string;
          playerPoolEntry?: { player?: EspnTradePlayer };
        }>;
      };
    }
  >;
};

export type EspnTradeSnapshot = {
  leagueName: string;
  scoringType: string | null;
  categoryLeague: boolean;
  replacementPpg: number;
  context: TradeLeagueContext;
  teams: TradeTeam[];
};

/** Starter slot ids expanded by count; bench / IR / unused slot ids excluded. */
export function expandStarterSlots(counts: Record<string, number>) {
  const slots: number[] = [];
  for (const [slotId, count] of Object.entries(counts)) {
    const id = Number(slotId);
    if (!Number.isInteger(id) || id >= BENCH_SLOT_ID) continue;
    for (let index = 0; index < count; index++) slots.push(id);
  }
  return slots.sort((a, b) => a - b);
}

async function fetchFreeAgentPlayers(
  leagueId: number,
  seasonYear: number,
  credentials?: EspnCredentials,
) {
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${seasonYear}/segments/0/leagues/${leagueId}?view=kona_player_info`;
  const data = await fetchEspnJson<{
    players?: Array<{ id?: number; player?: EspnTradePlayer }>;
  }>(url, credentials, {
    "x-fantasy-filter": JSON.stringify({
      players: {
        filterStatus: { value: ["FREEAGENT", "WAIVERS"] },
        limit: FREE_AGENT_POOL_SIZE,
        sortPercOwned: { sortPriority: 1, sortAsc: false },
        filterStatsForTopScoringPeriodIds: {
          value: 2,
          additionalValue: [
            `00${seasonYear}`,
            `02${seasonYear}`,
            `10${seasonYear}`,
            `00${seasonYear - 1}`,
          ],
        },
      },
    }),
  });
  return (data.players ?? [])
    .map((row) => row.player)
    .filter((player): player is EspnTradePlayer => Boolean(player));
}

/**
 * Everything the Trade Analyzer needs in one pass: every roster valued on the
 * same scale, the league's lineup slots, and the best free agents for
 * roster-balancing pickups.
 */
export async function fetchEspnTradeSnapshot(
  leagueId: number,
  seasonYear: number,
  credentials?: EspnCredentials,
): Promise<EspnTradeSnapshot> {
  const [data, proTeams, freeAgentPlayers] = await Promise.all([
    fetchEspnLeague(
      leagueId,
      seasonYear,
      ["mSettings", "mTeam", "mRoster"],
      credentials,
    ) as Promise<EspnTradeLeagueResponse>,
    fetchProTeamSchedules(seasonYear, credentials),
    fetchFreeAgentPlayers(leagueId, seasonYear, credentials),
  ]);

  const scoringType = data.settings?.scoringSettings?.scoringType ?? null;
  const currentScoringPeriod =
    data.scoringPeriodId ?? data.status?.latestScoringPeriod ?? 1;
  const finalScoringPeriod =
    data.status?.finalScoringPeriod ?? Number.POSITIVE_INFINITY;

  const proTeamInfo = new Map<number, { abbrev: string; remaining: number }>();
  for (const team of proTeams) {
    if (typeof team.id !== "number") continue;
    const remaining = Object.values(team.proGamesByScoringPeriod ?? {})
      .flat()
      .filter(
        (game) =>
          typeof game.scoringPeriodId === "number" &&
          game.scoringPeriodId >= currentScoringPeriod &&
          game.scoringPeriodId <= finalScoringPeriod,
      ).length;
    proTeamInfo.set(team.id, { abbrev: team.abbrev ?? "FA", remaining });
  }

  const toTradePlayer = (
    player: EspnTradePlayer,
    lineupSlotId: number | null,
    rosterInjuryStatus?: string,
  ): Omit<TradePlayer, "value"> & { rawValue: number } => {
    const injuryStatus = player.injuryStatus ?? rosterInjuryStatus ?? null;
    const pro = proTeamInfo.get(player.proTeamId ?? 0);
    const valuation = valuePlayer({
      stats: player.stats,
      seasonYear,
      injuryStatus,
      teamGamesRemaining: pro?.remaining ?? 0,
    });
    return {
      id: player.id ?? 0,
      name: player.fullName?.trim() ?? "Unknown player",
      proTeam: pro?.abbrev ?? "FA",
      positions: eligibleFantasyPositions(player),
      eligibleSlots: player.eligibleSlots ?? [],
      lineupSlotId,
      injuryStatus:
        injuryStatus && injuryStatus !== "ACTIVE" ? injuryStatus : null,
      ppg: valuation.ppg,
      projectedPpg: valuation.projectedPpg,
      seasonPpg: valuation.seasonPpg,
      seasonGamesPlayed: valuation.seasonGamesPlayed,
      recentPpg: valuation.recentPpg,
      availability: valuation.availability,
      gamesRemaining: valuation.gamesRemaining,
      restOfSeasonPoints: valuation.restOfSeasonPoints,
      rawValue: 0,
    };
  };

  const freeAgents = freeAgentPlayers
    .filter((player) => typeof player.id === "number")
    .map((player) => toTradePlayer(player, null))
    .sort((a, b) => b.ppg - a.ppg);
  const replacementPpg = replacementLevelPpg(
    freeAgents.map((player) => player.ppg),
  );

  const memberMap = buildMemberMap(data.members ?? []);
  const teamMap = buildTeamMap(data.teams ?? [], memberMap);

  const rawTeams = (data.teams ?? [])
    .filter((team) => typeof team.id === "number")
    .map((team) => {
      const players = (team.roster?.entries ?? []).flatMap((entry) => {
        const player = entry.playerPoolEntry?.player;
        if (!player || typeof (player.id ?? entry.playerId) !== "number") {
          return [];
        }
        return [
          toTradePlayer(
            { ...player, id: player.id ?? entry.playerId },
            entry.lineupSlotId ?? null,
            entry.injuryStatus,
          ),
        ];
      });
      return { team, players };
    });

  const withRawValue = <T extends { ppg: number; gamesRemaining: number }>(
    player: T,
  ) => ({
    ...player,
    rawValue: rawTradeValue({
      ppg: player.ppg,
      gamesRemaining: player.gamesRemaining,
      replacementPpg,
    }),
  });

  const rosteredRaw = rawTeams.flatMap(({ players }) =>
    players.map(withRawValue),
  );
  const maxRaw = Math.max(1, ...rosteredRaw.map((player) => player.rawValue));
  const finalize = ({
    rawValue,
    ...player
  }: Omit<TradePlayer, "value"> & { rawValue: number }): TradePlayer => ({
    ...player,
    value: (100 * rawValue) / maxRaw,
  });

  const teams: TradeTeam[] = rawTeams
    .map(({ team, players }) => {
      const info = teamMap.get(team.id!);
      const overall = team.record?.overall;
      return {
        id: team.id!,
        name: info?.name ?? `Team ${team.id}`,
        abbrev: info?.abbrev ?? `T${team.id}`,
        logoUrl: info?.logoUrl ?? null,
        ownerName: info?.ownerName ?? null,
        wins: overall?.wins ?? 0,
        losses: overall?.losses ?? 0,
        ties: overall?.ties ?? 0,
        players: players
          .map(withRawValue)
          .map(finalize)
          .sort((a, b) => b.value - a.value || b.ppg - a.ppg),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const slotCounts = data.settings?.rosterSettings?.lineupSlotCounts ?? {};
  const starterSlots = expandStarterSlots(slotCounts);
  const activeRosterLimit =
    starterSlots.length + (slotCounts[String(BENCH_SLOT_ID)] ?? 0);

  return {
    leagueName: data.settings?.name ?? "ESPN League",
    scoringType,
    categoryLeague: isCategoryScoring(scoringType),
    replacementPpg,
    context: {
      starterSlots,
      activeRosterLimit,
      freeAgents: freeAgents
        .slice(0, FREE_AGENTS_RETURNED)
        .map(withRawValue)
        .map(finalize),
    },
    teams,
  };
}
