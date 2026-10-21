import "server-only";

import {
  parseGameConstantsFromScoreboardHtml,
  type EspnGameConstants,
} from "@/server/espn/scoring-periods";

export type EspnCredentials = {
  espnS2?: string | null;
  swid?: string | null;
};

export type EspnLeagueSummary = {
  id: number;
  seasonId: number;
  name: string;
  isPrivate: boolean;
  scoringType: string | null;
  teamCount: number;
};

/** ESPN fantasy leagues rarely expose a custom logo; use the NBA mark as a stand-in. */
export const DEFAULT_LEAGUE_LOGO_URL =
  "https://a.espncdn.com/i/teamlogos/leagues/500/nba.png";

export type EspnMember = {
  id?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
};

export type EspnTeam = {
  id?: number;
  abbrev?: string;
  location?: string;
  nickname?: string;
  name?: string;
  logo?: string;
  owners?: string[];
  primaryOwner?: string;
  playoffSeed?: number;
  currentProjectedRank?: number;
  /** ESPN draft-day projected roster strength rank (1 = strongest). */
  draftDayProjectedRank?: number;
  playoffPct?: number;
  playoffClinchType?: string;
  eliminated?: boolean;
  currentSimulationResults?: {
    playoffPct?: number;
    rank?: number;
    playoffClinchType?: string;
  };
  roster?: {
    entries?: Array<{
      playerId?: number;
      lineupSlotId?: number;
      injuryStatus?: string;
      acquisitionType?: string;
      playerPoolEntry?: {
        player?: {
          id?: number;
          fullName?: string;
          defaultPositionId?: number;
          /** Lineup slots this player can fill (0=PG … 4=C, plus flex/UTIL). */
          eligibleSlots?: number[];
          injuryStatus?: string;
          injured?: boolean;
          stats?: Array<{
            id?: string;
            statSourceId?: number;
            statSplitTypeId?: number;
            appliedTotal?: number;
          }>;
        };
      };
    }>;
  };
  record?: {
    overall?: {
      wins?: number;
      losses?: number;
      ties?: number;
      percentage?: number;
      pointsFor?: number;
      pointsAgainst?: number;
      gamesBack?: number;
      streakLength?: number;
      streakType?: string;
    };
  };
};

/** ESPN playoffClinchType → standings symbols (same mapping as fantasy.espn.com). */
export const PLAYOFF_CLINCH_STATUS: Record<string, string> = {
  TOP_SEED_BYE: "*Z",
  TOP_SEED: "*",
  DIVISION_BYE: "YZ",
  DIVISION: "Y",
  PLAYOFFS_BYE: "XZ",
  PLAYOFFS: "X",
  ELIMINATED: "E",
  BYE: "Z",
};
export type EspnRosterEntry = {
  lineupSlotId?: number;
  playerId?: number;
  injuryStatus?: string;
  acquisitionType?: string;
  playerPoolEntry?: {
    appliedStatTotal?: number;
    player?: {
      fullName?: string;
      proTeamId?: number;
      defaultPositionId?: number;
      eligibleSlots?: number[];
      injuryStatus?: string;
      stats?: Array<{
        id?: string;
        statSourceId?: number;
        statSplitTypeId?: number;
        appliedTotal?: number;
      }>;
    };
  };
};

export type EspnScheduleSide = {
  teamId?: number;
  totalPoints?: number;
  totalPointsLive?: number;
  cumulativeScore?: {
    wins?: number;
    losses?: number;
    ties?: number;
  };
  rosterForCurrentScoringPeriod?: { entries?: EspnRosterEntry[] };
  rosterForMatchupPeriod?: { entries?: EspnRosterEntry[] };
};

export type EspnScheduleEntry = {
  matchupPeriodId?: number;
  home?: EspnScheduleSide;
  away?: EspnScheduleSide;
};

export type EspnLeagueResponse = {
  id?: number;
  seasonId?: number;
  scoringPeriodId?: number;
  settings?: {
    name?: string;
    logo?: string;
    isPublic?: boolean;
    scoringSettings?: {
      scoringType?: string;
    };
    scheduleSettings?: {
      matchupPeriodCount?: number;
      matchupPeriodLength?: number;
      matchupPeriods?: Record<string, number[]>;
      periodTypeId?: number;
      playoffMatchupPeriodLength?: number;
      playoffTeamCount?: number;
    };
  };
  status?: {
    currentMatchupPeriod?: number;
    latestScoringPeriod?: number;
  };
  members?: EspnMember[];
  teams?: EspnTeam[];
  schedule?: EspnScheduleEntry[];
};

export type EspnProTeam = {
  id?: number;
  abbrev?: string;
  proGamesByScoringPeriod?: Record<
    string,
    Array<{
      id?: number;
      date?: number;
      scoringPeriodId?: number;
      homeProTeamId?: number;
      awayProTeamId?: number;
    }>
  >;
};

export type EspnPlayersResponse = {
  players?: Array<{
    id?: number;
    player?: {
      id?: number;
      stats?: Array<{
        id?: string;
        statSourceId?: number;
        statSplitTypeId?: number;
        appliedTotal?: number;
      }>;
    };
  }>;
};

export function buildHeaders(credentials?: EspnCredentials): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (credentials?.espnS2 && credentials.swid) {
    headers.Cookie = `espn_s2=${credentials.espnS2}; SWID=${credentials.swid}`;
  }

  return headers;
}

export async function fetchEspnJson<T>(
  url: string,
  credentials?: EspnCredentials,
  extraHeaders?: HeadersInit,
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      ...buildHeaders(credentials),
      ...extraHeaders,
    },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "ESPN rejected the request. This league is likely private — add your espn_s2 and SWID cookies.",
    );
  }

  if (response.status === 404) {
    throw new Error("League not found. Check the league ID and season year.");
  }

  if (!response.ok) {
    throw new Error(`ESPN request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function fetchEspnLeague(
  leagueId: number,
  seasonYear: number,
  views: string[],
  credentials?: EspnCredentials,
  extraParams?: Record<string, string | number>,
): Promise<EspnLeagueResponse> {
  const params = new URLSearchParams();
  for (const view of views) {
    params.append("view", view);
  }
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      params.set(key, String(value));
    }
  }

  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${seasonYear}/segments/0/leagues/${leagueId}?${params.toString()}`;
  return fetchEspnJson<EspnLeagueResponse>(url, credentials);
}

export async function fetchProTeamSchedules(
  seasonYear: number,
  credentials?: EspnCredentials,
) {
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${seasonYear}?view=proTeamSchedules_wl`;
  const data = await fetchEspnJson<{
    settings?: { proTeams?: EspnProTeam[] };
  }>(url, credentials);
  return data.settings?.proTeams ?? [];
}

/** Season-level ESPN matchup calendar (shared across leagues). */
const gameConstantsCache = new Map<
  number,
  { constants: EspnGameConstants; fetchedAt: number }
>();
const GAME_CONSTANTS_TTL_MS = 6 * 60 * 60 * 1000;

export async function fetchEspnGameConstants(
  seasonYear: number,
  leagueId: number,
  credentials?: EspnCredentials,
): Promise<EspnGameConstants> {
  const cached = gameConstantsCache.get(seasonYear);
  if (cached && Date.now() - cached.fetchedAt < GAME_CONSTANTS_TTL_MS) {
    return cached.constants;
  }

  const url = `https://fantasy.espn.com/basketball/league/scoreboard?leagueId=${leagueId}&seasonId=${seasonYear}`;
  const response = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": "Mozilla/5.0",
      ...buildHeaders(credentials),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load ESPN matchup calendar (status ${response.status}).`,
    );
  }

  const html = await response.text();
  const constants = parseGameConstantsFromScoreboardHtml(html);
  if (!constants) {
    throw new Error(
      "ESPN matchup calendar was missing from the scoreboard page.",
    );
  }

  gameConstantsCache.set(seasonYear, { constants, fetchedAt: Date.now() });
  return constants;
}

export async function fetchPlayerProjections(
  leagueId: number,
  seasonYear: number,
  scoringPeriodId: number,
  playerIds: number[],
  credentials?: EspnCredentials,
) {
  const uniqueIds = [...new Set(playerIds)].filter((id) => id > 0);
  const projectionByPlayerId = new Map<number, number>();
  if (uniqueIds.length === 0) return projectionByPlayerId;

  const params = new URLSearchParams();
  params.append("view", "kona_player_info");
  params.set("scoringPeriodId", String(scoringPeriodId));
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${seasonYear}/segments/0/leagues/${leagueId}?${params.toString()}`;

  const data = await fetchEspnJson<EspnPlayersResponse>(url, credentials, {
    "x-fantasy-filter": JSON.stringify({
      players: {
        filterIds: { value: uniqueIds },
        filterStatsForTopScoringPeriodIds: {
          value: 2,
          additionalValue: [
            `00${seasonYear}`,
            `10${seasonYear}`,
            `00${seasonYear - 1}`,
            `10${seasonYear - 1}`,
          ],
        },
      },
    }),
  });

  for (const row of data.players ?? []) {
    const playerId = row.id ?? row.player?.id;
    if (typeof playerId !== "number") continue;
    const projected = (row.player?.stats ?? []).find(
      (stat) =>
        stat.statSourceId === 1 &&
        stat.statSplitTypeId === 0 &&
        (stat.id === `10${seasonYear}` || Boolean(stat.id?.startsWith("10"))),
    );
    if (
      typeof projected?.appliedTotal === "number" &&
      projected.appliedTotal > 0
    ) {
      projectionByPlayerId.set(playerId, projected.appliedTotal / 82);
      continue;
    }
    const prior = (row.player?.stats ?? []).find(
      (stat) =>
        stat.statSourceId === 0 &&
        stat.statSplitTypeId === 0 &&
        typeof stat.appliedTotal === "number" &&
        stat.appliedTotal > 100,
    );
    if (prior?.appliedTotal) {
      projectionByPlayerId.set(playerId, prior.appliedTotal / 82);
    }
  }

  return projectionByPlayerId;
}

export async function fetchNbaScoreboard() {
  try {
    const response = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export function teamDisplayName(team: EspnTeam) {
  const composed = [team.location, team.nickname]
    .filter(Boolean)
    .join(" ")
    .trim();
  const name = team.name?.trim();
  if (name) return name;
  if (composed) return composed;
  const abbrev = team.abbrev?.trim();
  if (abbrev) return abbrev;
  return `Team ${team.id ?? "?"}`;
}

export function normalizeLogoUrl(
  logo: string | null | undefined,
): string | null {
  const value = logo?.trim();
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `https://g.espncdn.com${value}`;
  return value;
}

export function memberDisplayName(member: EspnMember) {
  const fullName = [member.firstName, member.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (fullName) return fullName;
  const displayName = member.displayName?.trim();
  if (displayName) return displayName;
  return null;
}

export function buildMemberMap(members: EspnMember[]) {
  const map = new Map<string, string>();
  for (const member of members) {
    if (!member.id) continue;
    const name = memberDisplayName(member);
    if (name) map.set(member.id, name);
  }
  return map;
}

export function teamOwnerName(team: EspnTeam, members: Map<string, string>) {
  const ownerIds = [
    team.primaryOwner,
    ...(team.owners ?? []).filter((id) => id !== team.primaryOwner),
  ].filter((id): id is string => Boolean(id));

  const names = ownerIds
    .map((id) => members.get(id))
    .filter((name): name is string => Boolean(name));

  if (names.length === 0) return null;
  return [...new Set(names)].join(", ");
}

export function buildTeamMap(teams: EspnTeam[], members: Map<string, string>) {
  const map = new Map<
    number,
    {
      name: string;
      abbrev: string;
      logoUrl: string | null;
      ownerName: string | null;
      team: EspnTeam;
    }
  >();

  for (const team of teams) {
    if (typeof team.id !== "number") continue;
    map.set(team.id, {
      name: teamDisplayName(team),
      abbrev: team.abbrev?.trim() ?? `T${team.id}`,
      logoUrl: normalizeLogoUrl(team.logo),
      ownerName: teamOwnerName(team, members),
      team,
    });
  }

  return map;
}

export function buildInjuryByPlayerId(teams: EspnTeam[]) {
  const map = new Map<number, string>();
  for (const team of teams) {
    for (const entry of team.roster?.entries ?? []) {
      const playerId = entry.playerId ?? entry.playerPoolEntry?.player?.id;
      const status =
        entry.playerPoolEntry?.player?.injuryStatus ?? entry.injuryStatus;
      if (typeof playerId !== "number" || !status) continue;
      map.set(playerId, status);
    }
  }
  return map;
}

export function buildProGamesByTeam(proTeams: EspnProTeam[]) {
  const map = new Map<
    number,
    Array<{
      id?: number;
      date?: number;
      scoringPeriodId?: number;
      homeProTeamId?: number;
      awayProTeamId?: number;
    }>
  >();

  for (const team of proTeams) {
    if (typeof team.id !== "number") continue;
    const games = Object.values(team.proGamesByScoringPeriod ?? {}).flat();
    map.set(team.id, games);
  }

  return map;
}

export function isCategoryScoring(scoringType: string | null | undefined) {
  return Boolean(scoringType?.toUpperCase().includes("CATEGORY"));
}

export function sideMatchupScore(
  side: EspnScheduleSide | undefined,
  categoryLeague: boolean,
): number | null {
  if (categoryLeague) {
    const wins = side?.cumulativeScore?.wins;
    if (typeof wins === "number") return wins;
    return null;
  }
  if (typeof side?.totalPointsLive === "number") return side.totalPointsLive;
  if (typeof side?.totalPoints === "number") return side.totalPoints;
  return null;
}
