export const ACTIVE_LEAGUE_COOKIE = "active_league_id";

export function setActiveLeagueId(leagueId: string) {
  document.cookie = `${ACTIVE_LEAGUE_COOKIE}=${encodeURIComponent(leagueId)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function clearActiveLeagueId() {
  document.cookie = `${ACTIVE_LEAGUE_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
