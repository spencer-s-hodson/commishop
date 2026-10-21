import "server-only";

import {
  buildMatchupWinModel,
  collectActivePlayerIds,
  liveSideScore,
  parseNbaScoreboardProgress,
  projectMatchupSide,
} from "@/server/espn/matchup-projections";
import {
  computePowerRankings,
  type PowerRankingWeeklyResult,
} from "@/server/espn/power-rankings";
import {
  buildMatchupPeriodOptions,
  effectiveScoringPeriodId,
  parseGameConstantsFromScoreboardHtml,
  scoringPeriodsForMatchup,
  type EspnGameConstants,
  type MatchupPeriodOption,
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

export type EspnStandingRow = {
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
  /** Games behind the #1 team (0 = leader). */
  gamesBack: number;
  /** Formatted streak, e.g. W3 / L2, or null when none. */
  streak: string | null;
  /** ESPN clinch marker(s): X, Y, Z, *, E (may combine, e.g. *Z). */
  clinchStatus: string | null;
  /** Current standing / projected rank (1 = first). */
  rank: number;
  /** ESPN simulation chance of making the playoffs (0–1). */
  playoffPct: number | null;
};

export type EspnMatchupSide = {
  teamId: number;
  name: string;
  abbrev: string;
  logoUrl: string | null;
  ownerName: string | null;
  score: number;
  projectedScore: number | null;
  gamesThisWeek: number | null;
  gamesRemaining: number | null;
  playersRemaining: number | null;
  categoryRecord: string | null;
};

export type EspnMatchupCard = {
  matchupPeriodId: number;
  home: EspnMatchupSide;
  away: EspnMatchupSide | null;
  homeWinProbability: number | null;
  awayWinProbability: number | null;
};

export type EspnLeagueScheduleSettings = {
  matchupPeriodCount: number | null;
  matchupPeriodLength: number | null;
  playoffMatchupPeriodLength: number | null;
  playoffTeamCount: number | null;
  periodTypeId: number | null;
};

export type EspnLeagueOverview = {
  leagueId: number;
  seasonYear: number;
  name: string;
  logoUrl: string | null;
  scoringType: string | null;
  /** League's live/current matchup week. */
  currentMatchupPeriod: number;
  /** Week currently loaded in this response. */
  selectedMatchupPeriod: number;
  scoringPeriodId: number;
  /** Live schedule/playoff settings from ESPN (not stored locally). */
  scheduleSettings: EspnLeagueScheduleSettings;
  matchupPeriodOptions: MatchupPeriodOption[];
  standings: EspnStandingRow[];
  matchups: EspnMatchupCard[];
};

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

/** ESPN fantasy leagues rarely expose a custom logo; use the NBA mark as a stand-in. */
const DEFAULT_LEAGUE_LOGO_URL =
  "https://a.espncdn.com/i/teamlogos/leagues/500/nba.png";

type EspnMember = {
  id?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
};

type EspnTeam = {
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
const PLAYOFF_CLINCH_STATUS: Record<string, string> = {
  TOP_SEED_BYE: "*Z",
  TOP_SEED: "*",
  DIVISION_BYE: "YZ",
  DIVISION: "Y",
  PLAYOFFS_BYE: "XZ",
  PLAYOFFS: "X",
  ELIMINATED: "E",
  BYE: "Z",
};

function formatStreak(streakType: string | undefined, streakLength: number | undefined) {
  if (!streakType || streakType === "NONE" || !streakLength || streakLength <= 0) {
    return null;
  }
  if (streakType === "WIN") return `W${streakLength}`;
  if (streakType === "LOSS") return `L${streakLength}`;
  return null;
}

function resolveClinchStatus(team: EspnTeam): string | null {
  if (team.eliminated) return "E";
  const clinchType =
    team.playoffClinchType ?? team.currentSimulationResults?.playoffClinchType;
  if (!clinchType || clinchType === "UNKNOWN") return null;
  return PLAYOFF_CLINCH_STATUS[clinchType] ?? null;
}

type EspnRosterEntry = {
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

type EspnScheduleSide = {
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

type EspnScheduleEntry = {
  matchupPeriodId?: number;
  home?: EspnScheduleSide;
  away?: EspnScheduleSide;
};

type EspnLeagueResponse = {
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

type EspnProTeam = {
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

type EspnPlayersResponse = {
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

function buildHeaders(credentials?: EspnCredentials): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (credentials?.espnS2 && credentials.swid) {
    headers.Cookie = `espn_s2=${credentials.espnS2}; SWID=${credentials.swid}`;
  }

  return headers;
}

async function fetchEspnJson<T>(
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

async function fetchEspnLeague(
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

async function fetchProTeamSchedules(
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

async function fetchEspnGameConstants(
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
    throw new Error("ESPN matchup calendar was missing from the scoreboard page.");
  }

  gameConstantsCache.set(seasonYear, { constants, fetchedAt: Date.now() });
  return constants;
}

async function fetchPlayerProjections(
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
    if (typeof projected?.appliedTotal === "number" && projected.appliedTotal > 0) {
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

async function fetchNbaScoreboard() {
  try {
    const response = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!response.ok) return null;
    return (await response.json()) as Parameters<
      typeof parseNbaScoreboardProgress
    >[0];
  } catch {
    return null;
  }
}

function teamDisplayName(team: EspnTeam) {
  const composed = [team.location, team.nickname].filter(Boolean).join(" ").trim();
  const name = team.name?.trim();
  if (name) return name;
  if (composed) return composed;
  const abbrev = team.abbrev?.trim();
  if (abbrev) return abbrev;
  return `Team ${team.id ?? "?"}`;
}

function normalizeLogoUrl(logo: string | null | undefined): string | null {
  const value = logo?.trim();
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `https://g.espncdn.com${value}`;
  return value;
}

function memberDisplayName(member: EspnMember) {
  const fullName = [member.firstName, member.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (fullName) return fullName;
  const displayName = member.displayName?.trim();
  if (displayName) return displayName;
  return null;
}

function buildMemberMap(members: EspnMember[]) {
  const map = new Map<string, string>();
  for (const member of members) {
    if (!member.id) continue;
    const name = memberDisplayName(member);
    if (name) map.set(member.id, name);
  }
  return map;
}

function teamOwnerName(team: EspnTeam, members: Map<string, string>) {
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

function buildTeamMap(teams: EspnTeam[], members: Map<string, string>) {
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

function categoryRecord(side: EspnScheduleSide | undefined) {
  const wins = side?.cumulativeScore?.wins;
  const losses = side?.cumulativeScore?.losses;
  const ties = side?.cumulativeScore?.ties;
  if (wins == null && losses == null && ties == null) return null;
  const w = wins ?? 0;
  const l = losses ?? 0;
  const t = ties ?? 0;
  return t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`;
}

function toMatchupSide(
  side: EspnScheduleSide | undefined,
  teamMap: ReturnType<typeof buildTeamMap>,
  fallbackLabel: string,
  projection?: {
    liveScore: number;
    projectedScore: number;
    gamesThisWeek: number;
    gamesRemaining: number;
    playersRemaining: number;
  },
): EspnMatchupSide {
  const teamId = side?.teamId ?? 0;
  const team = teamId ? teamMap.get(teamId) : undefined;
  return {
    teamId,
    name: team?.name ?? `Team ${teamId > 0 ? teamId : "?"}`,
    abbrev: team?.abbrev ?? fallbackLabel,
    logoUrl: team?.logoUrl ?? null,
    ownerName: team?.ownerName ?? null,
    score: projection?.liveScore ?? liveSideScore(side),
    projectedScore: projection?.projectedScore ?? null,
    gamesThisWeek: projection?.gamesThisWeek ?? null,
    gamesRemaining: projection?.gamesRemaining ?? null,
    playersRemaining: projection?.playersRemaining ?? null,
    categoryRecord: categoryRecord(side),
  };
}

function buildInjuryByPlayerId(teams: EspnTeam[]) {
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

function buildProGamesByTeam(proTeams: EspnProTeam[]) {
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

export async function fetchEspnLeagueSummary(
  leagueId: number,
  seasonYear: number,
  credentials?: EspnCredentials,
): Promise<EspnLeagueSummary> {
  const data = await fetchEspnLeague(
    leagueId,
    seasonYear,
    ["mSettings", "mTeam"],
    credentials,
  );

  const name = data.settings?.name?.trim();
  if (!name) {
    throw new Error("Unexpected ESPN response — league name missing.");
  }

  const hasCookies = Boolean(credentials?.espnS2 && credentials.swid);
  const isPrivate = data.settings?.isPublic === false || hasCookies;

  return {
    id: data.id ?? leagueId,
    seasonId: data.seasonId ?? seasonYear,
    name,
    isPrivate,
    scoringType: data.settings?.scoringSettings?.scoringType ?? null,
    teamCount: Array.isArray(data.teams) ? data.teams.length : 0,
  };
}

export async function fetchEspnLeagueOverview(
  leagueId: number,
  seasonYear: number,
  credentials?: EspnCredentials,
  options?: { matchupPeriodId?: number },
): Promise<EspnLeagueOverview> {
  const bootstrap = await fetchEspnLeague(
    leagueId,
    seasonYear,
    ["mSettings", "mTeam", "mStandings", "mScoreboard"],
    credentials,
  );

  const currentMatchupPeriod =
    bootstrap.status?.currentMatchupPeriod ?? bootstrap.scoringPeriodId ?? 1;
  const liveScoringPeriodId =
    bootstrap.scoringPeriodId ??
    bootstrap.status?.latestScoringPeriod ??
    currentMatchupPeriod;

  const schedule = bootstrap.settings?.scheduleSettings;
  const matchupPeriods = schedule?.matchupPeriods ?? {};
  const matchupPeriodCount = schedule?.matchupPeriodCount;
  const playoffMatchupPeriodLength = schedule?.playoffMatchupPeriodLength;
  const scheduleSettings: EspnLeagueScheduleSettings = {
    matchupPeriodCount: matchupPeriodCount ?? null,
    matchupPeriodLength: schedule?.matchupPeriodLength ?? null,
    playoffMatchupPeriodLength: playoffMatchupPeriodLength ?? null,
    playoffTeamCount: schedule?.playoffTeamCount ?? null,
    periodTypeId: schedule?.periodTypeId ?? null,
  };

  const [proTeams, gameConstants] = await Promise.all([
    fetchProTeamSchedules(seasonYear, credentials),
    fetchEspnGameConstants(seasonYear, leagueId, credentials),
  ]);

  const matchupPeriodOptions = buildMatchupPeriodOptions({
    constants: gameConstants,
    matchupPeriods,
    matchupPeriodCount,
    playoffMatchupPeriodLength,
  });

  const requestedPeriod = options?.matchupPeriodId;
  const selectedMatchupPeriod =
    requestedPeriod != null &&
    matchupPeriodOptions.some((option) => option.matchupPeriodId === requestedPeriod)
      ? requestedPeriod
      : currentMatchupPeriod;

  const selectedOption = matchupPeriodOptions.find(
    (option) => option.matchupPeriodId === selectedMatchupPeriod,
  );
  const scoringPeriodIds =
    selectedOption?.scoringPeriodIds ??
    scoringPeriodsForMatchup({
      matchupPeriodId: selectedMatchupPeriod,
      constants: gameConstants,
      matchupPeriods,
      fallbackScoringPeriodIds: [liveScoringPeriodId],
    });

  const scoringPeriodId = effectiveScoringPeriodId({
    selectedMatchupPeriodId: selectedMatchupPeriod,
    currentMatchupPeriodId: currentMatchupPeriod,
    liveScoringPeriodId,
    weekScoringPeriodIds: scoringPeriodIds,
  });

  const data = await fetchEspnLeague(
    leagueId,
    seasonYear,
    [
      "mSettings",
      "mTeam",
      "mRoster",
      "mStandings",
      "mMatchupScore",
      "mScoreboard",
      "mBoxscore",
    ],
    credentials,
    {
      scoringPeriodId,
      matchupPeriodId: selectedMatchupPeriod,
    },
  );

  const name = data.settings?.name?.trim() ?? `League ${leagueId}`;
  const scoringType = data.settings?.scoringSettings?.scoringType ?? null;
  const memberMap = buildMemberMap(data.members ?? []);
  const teamMap = buildTeamMap(data.teams ?? [], memberMap);

  const standings: EspnStandingRow[] = [...teamMap.values()]
    .map(({ name: teamName, abbrev, logoUrl, ownerName, team }, index) => {
      const overall = team.record?.overall;
      const sim = team.currentSimulationResults;
      const rank =
        (typeof team.currentProjectedRank === "number" &&
        team.currentProjectedRank > 0
          ? team.currentProjectedRank
          : null) ??
        (typeof sim?.rank === "number" && sim.rank > 0 ? sim.rank : null) ??
        (typeof team.playoffSeed === "number" && team.playoffSeed > 0
          ? team.playoffSeed
          : null) ??
        index + 1;
      const playoffPct =
        (typeof sim?.playoffPct === "number" ? sim.playoffPct : null) ??
        (typeof team.playoffPct === "number" ? team.playoffPct : null);

      return {
        teamId: team.id!,
        name: teamName,
        abbrev,
        logoUrl,
        ownerName,
        wins: overall?.wins ?? 0,
        losses: overall?.losses ?? 0,
        ties: overall?.ties ?? 0,
        pointsFor: overall?.pointsFor ?? 0,
        pointsAgainst: overall?.pointsAgainst ?? 0,
        gamesBack: overall?.gamesBack ?? 0,
        streak: formatStreak(overall?.streakType, overall?.streakLength),
        clinchStatus: resolveClinchStatus(team),
        rank,
        playoffPct,
      };
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pointsFor - a.pointsFor;
    });

  const periodMatchups = (data.schedule ?? []).filter(
    (entry) => entry.matchupPeriodId === selectedMatchupPeriod,
  );

  const playerIds = periodMatchups.flatMap((entry) => [
    ...collectActivePlayerIds(entry.home),
    ...collectActivePlayerIds(entry.away),
  ]);

  const [projectionByPlayerId, scoreboard] = await Promise.all([
    fetchPlayerProjections(
      leagueId,
      seasonYear,
      scoringPeriodId,
      playerIds,
      credentials,
    ),
    selectedMatchupPeriod === currentMatchupPeriod
      ? fetchNbaScoreboard()
      : Promise.resolve(null),
  ]);

  const proGamesByTeam = buildProGamesByTeam(proTeams);
  const progressByProTeam = parseNbaScoreboardProgress(scoreboard);
  const injuryByPlayerId = buildInjuryByPlayerId(data.teams ?? []);

  const matchups: EspnMatchupCard[] = periodMatchups.map((entry) => {
    const homeProjection = projectMatchupSide({
      side: entry.home,
      scoringPeriodIds,
      currentScoringPeriodId: scoringPeriodId,
      seasonYear,
      proGamesByTeam,
      projectionByPlayerId,
      progressByProTeam,
      injuryByPlayerId,
    });

    const awayProjection =
      entry.away?.teamId != null
        ? projectMatchupSide({
            side: entry.away,
            scoringPeriodIds,
            currentScoringPeriodId: scoringPeriodId,
            seasonYear,
            proGamesByTeam,
            projectionByPlayerId,
            progressByProTeam,
            injuryByPlayerId,
          })
        : null;

    const winModel =
      awayProjection != null
        ? buildMatchupWinModel(homeProjection, awayProjection)
        : null;

    return {
      matchupPeriodId: entry.matchupPeriodId ?? selectedMatchupPeriod,
      home: toMatchupSide(entry.home, teamMap, "HOME", homeProjection),
      away:
        entry.away?.teamId != null
          ? toMatchupSide(entry.away, teamMap, "AWAY", awayProjection ?? undefined)
          : null,
      homeWinProbability: winModel?.homeWinProbability ?? null,
      awayWinProbability: winModel?.awayWinProbability ?? null,
    };
  });

  return {
    leagueId: data.id ?? leagueId,
    seasonYear: data.seasonId ?? seasonYear,
    name,
    logoUrl: normalizeLogoUrl(data.settings?.logo) ?? DEFAULT_LEAGUE_LOGO_URL,
    scoringType,
    currentMatchupPeriod,
    selectedMatchupPeriod,
    scoringPeriodId,
    scheduleSettings,
    matchupPeriodOptions,
    standings,
    matchups,
  };
}

function isCategoryScoring(scoringType: string | null | undefined) {
  return Boolean(scoringType?.toUpperCase().includes("CATEGORY"));
}

function sideMatchupScore(
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
  if (typeof projected?.appliedTotal === "number" && projected.appliedTotal > 0) {
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
  const normalized = status.trim().toUpperCase().replace(/[\s-]+/g, "_");
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
      if (!POSITION_GROUPS.includes(player.position as (typeof POSITION_GROUPS)[number])) {
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

    const totals = positionTotalsByTeam.get(teamId) ?? new Map();
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
      (a, b) => a.leagueRank - b.leagueRank || b.projectedPpgTotal - a.projectedPpgTotal,
    );
    const byWorstRank = [...withProduction].sort(
      (a, b) => b.leagueRank - a.leagueRank || a.projectedPpgTotal - b.projectedPpgTotal,
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
