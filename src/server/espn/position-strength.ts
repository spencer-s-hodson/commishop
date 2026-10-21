/**
 * Position-group strength for blurbs.
 *
 * ESPN uses two ID spaces:
 * - defaultPositionId: 1=PG … 5=C (primary label)
 * - eligibleSlots / lineupSlotId: 0=PG … 4=C (who can fill that roster slot)
 */

export const POSITION_GROUPS = ["PG", "SG", "SF", "PF", "C"] as const;
export type FantasyPosition = (typeof POSITION_GROUPS)[number];

/** Lineup slot ids for the five standard positions. */
export const POSITION_LINEUP_SLOT: Record<FantasyPosition, number> = {
  PG: 0,
  SG: 1,
  SF: 2,
  PF: 3,
  C: 4,
};

/** ESPN player.defaultPositionId → primary position. */
export const FBA_DEFAULT_POSITION: Record<number, FantasyPosition> = {
  1: "PG",
  2: "SG",
  3: "SF",
  4: "PF",
  5: "C",
};

export const POSITION_TOP_N = 3;

/**
 * Positions this player can fill in a standard lineup.
 * Prefers eligibleSlots (multi-pos); falls back to primary defaultPositionId.
 */
export function eligibleFantasyPositions(input: {
  eligibleSlots?: number[] | null;
  defaultPositionId?: number | null;
}): FantasyPosition[] {
  const slots = input.eligibleSlots ?? [];
  const fromSlots = POSITION_GROUPS.filter((position) =>
    slots.includes(POSITION_LINEUP_SLOT[position]),
  );
  if (fromSlots.length > 0) return [...fromSlots];

  const primary = FBA_DEFAULT_POSITION[input.defaultPositionId ?? -1];
  return primary ? [primary] : [];
}

/** Sum of the top N projected PPG values (descending). */
export function topNProjectedPpgSum(
  projectedPpgs: number[],
  n: number = POSITION_TOP_N,
): number {
  if (projectedPpgs.length === 0 || n <= 0) return 0;
  return [...projectedPpgs]
    .sort((a, b) => b - a)
    .slice(0, n)
    .reduce((sum, value) => sum + value, 0);
}

export function rankDescending(values: number[], value: number): number {
  const sorted = [...values].sort((a, b) => b - a);
  const index = sorted.indexOf(value);
  return index >= 0 ? index + 1 : sorted.length;
}
