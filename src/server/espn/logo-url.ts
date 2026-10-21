const MYSTIQUE_HOST = "mystique-api.fantasy.espn.com";
const MYSTIQUE_PATH_PREFIX = "/apis/v1/domains/lm/images/";

export function isEspnCustomLogoUrl(logoUrl: string) {
  try {
    const url = new URL(logoUrl);
    return (
      url.hostname === MYSTIQUE_HOST &&
      url.pathname.startsWith(MYSTIQUE_PATH_PREFIX)
    );
  } catch {
    return false;
  }
}

/** Custom ESPN uploads require cookies; proxy them through our authenticated route. */
export function toDisplayLogoUrl(
  logoUrl: string | null,
  connectedLeagueId: string,
): string | null {
  if (!logoUrl) return null;
  if (!isEspnCustomLogoUrl(logoUrl)) return logoUrl;

  const params = new URLSearchParams({
    leagueId: connectedLeagueId,
    src: logoUrl,
  });
  return `/api/espn/logo?${params.toString()}`;
}
