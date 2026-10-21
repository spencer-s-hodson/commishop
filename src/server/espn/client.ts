/**
 * ESPN Fantasy adapter entrypoint.
 * Prefer importing from overview / power-feed / blurb-context / shared directly.
 */
export type { EspnCredentials, EspnLeagueSummary } from "@/server/espn/shared";

export type {
  EspnLeagueOverview,
  EspnLeagueScheduleSettings,
  EspnMatchupCard,
  EspnMatchupSide,
  EspnStandingRow,
} from "@/server/espn/overview";
export {
  fetchEspnLeagueOverview,
  fetchEspnLeagueSummary,
} from "@/server/espn/overview";

export type {
  EspnDraftDayTeamRow,
  EspnPowerRankingRow,
  EspnPowerRankings,
} from "@/server/espn/power-feed";
export {
  fetchEspnDraftDayRankings,
  fetchEspnMatchupPeriodOptions,
  fetchEspnPowerRankings,
} from "@/server/espn/power-feed";

export type {
  EspnBlurbCompletedMatchup,
  EspnBlurbRosterPlayer,
  EspnBlurbScheduleContext,
  EspnBlurbTeamRoster,
  EspnBlurbUpcomingMatchup,
} from "@/server/espn/blurb-context";
export {
  fetchEspnBlurbRosterContext,
  fetchEspnBlurbScheduleContext,
} from "@/server/espn/blurb-context";
