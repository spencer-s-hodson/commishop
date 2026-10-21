import "server-only";

import {
  buildMatchupWinModel,
  collectActivePlayerIds,
  liveSideScore,
  parseNbaScoreboardProgress,
  projectMatchupSide,
} from "@/server/espn/matchup-projections";
import {
  buildMatchupPeriodOptions,
  effectiveScoringPeriodId,
  scoringPeriodsForMatchup,
  type MatchupPeriodOption,
} from "@/server/espn/scoring-periods";
import {
  DEFAULT_LEAGUE_LOGO_URL,
  PLAYOFF_CLINCH_STATUS,
  buildInjuryByPlayerId,
  buildMemberMap,
  buildProGamesByTeam,
  buildTeamMap,
  fetchEspnGameConstants,
  fetchEspnLeague,
  fetchNbaScoreboard,
  fetchPlayerProjections,
  fetchProTeamSchedules,
  normalizeLogoUrl,
  type EspnCredentials,
  type EspnLeagueSummary,
  type EspnScheduleSide,
  type EspnTeam,
} from "@/server/espn/shared";

export type { EspnLeagueSummary };

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

function formatStreak(
  streakType: string | undefined,
  streakLength: number | undefined,
) {
  if (
    !streakType ||
    streakType === "NONE" ||
    !streakLength ||
    streakLength <= 0
  ) {
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
    matchupPeriodOptions.some(
      (option) => option.matchupPeriodId === requestedPeriod,
    )
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
  const progressByProTeam = parseNbaScoreboardProgress(
    scoreboard as Parameters<typeof parseNbaScoreboardProgress>[0],
  );
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
          ? toMatchupSide(
              entry.away,
              teamMap,
              "AWAY",
              awayProjection ?? undefined,
            )
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
