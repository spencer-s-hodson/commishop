/**
 * ESPN Fantasy Football–style power rankings (espnff / espn-api).
 *
 * power = 0.80 * dominance + 0.15 * avgScore + 0.05 * avgMOV
 * where dominance is the row sum of (W + W²) for the league win matrix.
 */

export type PowerRankingWeeklyResult = {
  teamId: number;
  opponentId: number;
  /** Points scored (or category wins in cats leagues). */
  score: number;
  /** Margin of victory (score − opponent score). */
  mov: number;
};

export type PowerRankingTeamInput = {
  teamId: number;
};

export type PowerRankingComputed = {
  teamId: number;
  rank: number;
  powerScore: number;
  dominance: number;
  avgScore: number;
  avgMov: number;
  weeksPlayed: number;
};

/** Square an n×n matrix. */
export function squareMatrix(matrix: number[][]): number[][] {
  const n = matrix.length;
  const result: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  );

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += (matrix[i]?.[k] ?? 0) * (matrix[k]?.[j] ?? 0);
      }
      result[i]![j] = sum;
    }
  }

  return result;
}

/** Element-wise add of two n×n matrices. */
export function addMatrix(a: number[][], b: number[][]): number[][] {
  const n = a.length;
  const result: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  );

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      result[i]![j] = (a[i]?.[j] ?? 0) + (b[i]?.[j] ?? 0);
    }
  }

  return result;
}

/**
 * Two-step dominance: row sums of (W + W²).
 * Beating a team that beat others is rewarded via W².
 */
export function twoStepDominance(winMatrix: number[][]): number[] {
  const combined = addMatrix(squareMatrix(winMatrix), winMatrix);
  return combined.map((row) => row.reduce((sum, value) => sum + value, 0));
}

/**
 * Build an n×n win matrix ordered by `teamIds`.
 * `winMatrix[i][j]` = times team i beat team j across the given results.
 */
export function buildWinMatrix(
  teamIds: number[],
  results: PowerRankingWeeklyResult[],
): number[][] {
  const indexById = new Map(teamIds.map((id, index) => [id, index]));
  const n = teamIds.length;
  const winMatrix: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  );

  for (const result of results) {
    if (result.mov <= 0) continue;
    const i = indexById.get(result.teamId);
    const j = indexById.get(result.opponentId);
    if (i == null || j == null) continue;
    winMatrix[i]![j] = (winMatrix[i]![j] ?? 0) + 1;
  }

  return winMatrix;
}

/**
 * Compute ESPN-style power rankings for the given teams and weekly results.
 * Teams with no weeks played still appear (zeros); sort is by powerScore desc.
 */
export function computePowerRankings(
  teams: PowerRankingTeamInput[],
  results: PowerRankingWeeklyResult[],
): PowerRankingComputed[] {
  const teamIds = [...teams.map((team) => team.teamId)].sort((a, b) => a - b);
  const winMatrix = buildWinMatrix(teamIds, results);
  const dominanceByIndex = twoStepDominance(winMatrix);

  const resultsByTeam = new Map<number, PowerRankingWeeklyResult[]>();
  for (const result of results) {
    const list = resultsByTeam.get(result.teamId) ?? [];
    list.push(result);
    resultsByTeam.set(result.teamId, list);
  }

  const computed: PowerRankingComputed[] = teamIds.map((teamId, index) => {
    const teamResults = resultsByTeam.get(teamId) ?? [];
    const weeksPlayed = teamResults.length;
    const avgScore =
      weeksPlayed > 0
        ? teamResults.reduce((sum, row) => sum + row.score, 0) / weeksPlayed
        : 0;
    const avgMov =
      weeksPlayed > 0
        ? teamResults.reduce((sum, row) => sum + row.mov, 0) / weeksPlayed
        : 0;
    const dominance = dominanceByIndex[index] ?? 0;

    // Match espnff: int() truncation before weighting.
    const powerScore =
      Math.trunc(dominance) * 0.8 +
      Math.trunc(avgScore) * 0.15 +
      Math.trunc(avgMov) * 0.05;

    return {
      teamId,
      rank: 0,
      powerScore: Number(powerScore.toFixed(2)),
      dominance,
      avgScore,
      avgMov,
      weeksPlayed,
    };
  });

  computed.sort((a, b) => {
    if (b.powerScore !== a.powerScore) return b.powerScore - a.powerScore;
    if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
    return a.teamId - b.teamId;
  });

  return computed.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}
