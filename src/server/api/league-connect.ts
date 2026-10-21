/** Null out blank optional ESPN cookie fields. */
export function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed;
}

/**
 * Private leagues need both espn_s2 and SWID (or neither for public).
 * Returns an error message when the pair is incomplete.
 */
export function privateLeagueCredentialsError(
  espnS2: string | null,
  swid: string | null,
): string | null {
  if ((espnS2 && !swid) || (!espnS2 && swid)) {
    return "Provide both espn_s2 and SWID for private leagues.";
  }
  return null;
}
