/**
 * ESPN Fantasycast-style win probability (from reverse-engineered FF JS):
 * margin = projA - projB
 * sd = sqrt(((ceilA - projA)^2 + (ceilB - projB)^2) / 2)
 * P(A wins) ≈ Φ(margin / sd)
 */

/** Standard normal CDF (Abramowitz & Stegun). */
export function normalCdf(z: number) {
  const absZ = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * absZ);
  const density = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
  const poly =
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const cdf = 1 - density * poly;
  return z >= 0 ? cdf : 1 - cdf;
}

const MIN_PROB = 0.02;
const MAX_PROB = 0.98;

export function espnStyleWinProbability(input: {
  teamProjected: number;
  teamCeiling: number;
  opponentProjected: number;
  opponentCeiling: number;
  minutesOrGamesRemaining: boolean;
}): number {
  const margin = input.teamProjected - input.opponentProjected;
  const teamSpread = input.teamCeiling - input.teamProjected;
  const opponentSpread = input.opponentCeiling - input.opponentProjected;
  const variance = (Math.pow(teamSpread, 2) + Math.pow(opponentSpread, 2)) / 2;
  const sd = Math.sqrt(Math.max(variance, 0));

  if (!(input.teamProjected || input.opponentProjected)) {
    return 0.5;
  }

  if (sd <= 0) {
    if (margin === 0) return 0.5;
    // No games left → the result is final, so don't hedge at 98/2.
    if (!input.minutesOrGamesRemaining) return margin > 0 ? 1 : 0;
    return margin > 0 ? MAX_PROB : MIN_PROB;
  }

  let probability = normalCdf(margin / sd);

  if (input.minutesOrGamesRemaining) {
    if (probability >= 1) probability = MAX_PROB;
    else if (probability <= 0) probability = MIN_PROB;
    else probability = Math.min(MAX_PROB, Math.max(MIN_PROB, probability));
  } else {
    probability = Math.min(1, Math.max(0, probability));
  }

  return probability;
}
