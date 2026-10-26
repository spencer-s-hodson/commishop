/**
 * Fantasy basketball power rankings.
 *
 * Weighted blend of:
 * - Record (H2H win%)
 * - All-play win% (each week, record vs every other team's score — strips
 *   matchup luck, e.g. a 2nd-best score that lost to the 1st)
 * - Scoring (average weekly points for — rewards streaming / high PF)
 * - Strength of schedule (avg of opponent win% and opponent all-play win%)
 *
 * Margin of victory is intentionally unused: fantasy "defense" isn't a thing —
 * PA / opponent quality is about who you faced, not stopping them.
 */

export type PowerRankingWeeklyResult = {
  /** Matchup period (week) — groups scores for all-play. */
  period: number;
  teamId: number;
  opponentId: number;
  /** Points scored (or category wins in cats leagues). */
  score: number;
  /** Margin of victory (score − opponent score). Kept for schedule context only. */
  mov: number;
};

export type PowerRankingTeamInput = {
  teamId: number;
};

export type PowerRankingComputed = {
  teamId: number;
  rank: number;
  powerScore: number;
  /** Avg of opponent win% and opponent all-play win% (0–1). Higher = tougher schedule. */
  sos: number;
  avgScore: number;
  /** Retained for storage/compat; not used in the power formula. */
  avgMov: number;
  weeksPlayed: number;
  wins: number;
  losses: number;
  ties: number;
};

const WEIGHT_RECORD = 0.3;
const WEIGHT_ALL_PLAY = 0.2;
const WEIGHT_SCORING = 0.3;
const WEIGHT_SOS = 0.2;

function winPct(wins: number, losses: number, ties: number) {
  const games = wins + losses + ties;
  if (games === 0) return 0;
  return (wins + ties * 0.5) / games;
}

/** Map value into [0, 1] within the league distribution. Flat → 0.5. */
export function minMaxNormalize(values: number[], value: number): number {
  if (values.length === 0) return 0.5;
  let min = values[0]!;
  let max = values[0]!;
  for (const entry of values) {
    if (entry < min) min = entry;
    if (entry > max) max = entry;
  }
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

function recordFromResults(teamResults: PowerRankingWeeklyResult[]) {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const result of teamResults) {
    if (result.mov > 0) wins += 1;
    else if (result.mov < 0) losses += 1;
    else ties += 1;
  }
  return { wins, losses, ties };
}

/**
 * All-play win% per team: each week, a team "plays" every other team that
 * reported a score that week (ties count half), averaged across weeks.
 */
export function allPlayWinPctByTeam(
  results: PowerRankingWeeklyResult[],
): Map<number, number> {
  const scoresByPeriod = new Map<number, number[]>();
  for (const result of results) {
    const list = scoresByPeriod.get(result.period) ?? [];
    list.push(result.score);
    scoresByPeriod.set(result.period, list);
  }

  const weeklyPctsByTeam = new Map<number, number[]>();
  for (const result of results) {
    const weekScores = scoresByPeriod.get(result.period) ?? [];
    const opponents = weekScores.length - 1;
    if (opponents <= 0) continue;
    let wins = 0;
    for (const score of weekScores) {
      if (score < result.score) wins += 1;
      else if (score === result.score) wins += 0.5;
    }
    // Own score counted as a tie above — remove it.
    wins -= 0.5;
    const list = weeklyPctsByTeam.get(result.teamId) ?? [];
    list.push(wins / opponents);
    weeklyPctsByTeam.set(result.teamId, list);
  }

  const allPlay = new Map<number, number>();
  for (const [teamId, pcts] of weeklyPctsByTeam) {
    allPlay.set(
      teamId,
      pcts.reduce((sum, value) => sum + value, 0) / pcts.length,
    );
  }
  return allPlay;
}

/**
 * Compute power rankings from weekly H2H results.
 * Teams with no games still appear (zeros); sort is by powerScore desc.
 */
export function computePowerRankings(
  teams: PowerRankingTeamInput[],
  results: PowerRankingWeeklyResult[],
): PowerRankingComputed[] {
  const teamIds = [...teams.map((team) => team.teamId)].sort((a, b) => a - b);

  const resultsByTeam = new Map<number, PowerRankingWeeklyResult[]>();
  for (const result of results) {
    const list = resultsByTeam.get(result.teamId) ?? [];
    list.push(result);
    resultsByTeam.set(result.teamId, list);
  }

  const winPctByTeam = new Map<number, number>();
  for (const teamId of teamIds) {
    const teamResults = resultsByTeam.get(teamId) ?? [];
    const record = recordFromResults(teamResults);
    winPctByTeam.set(teamId, winPct(record.wins, record.losses, record.ties));
  }

  const allPlayByTeam = allPlayWinPctByTeam(results);

  type TeamStats = {
    teamId: number;
    wins: number;
    losses: number;
    ties: number;
    winPct: number;
    allPlayPct: number;
    avgScore: number;
    avgMov: number;
    sos: number;
    weeksPlayed: number;
  };

  const stats: TeamStats[] = teamIds.map((teamId) => {
    const teamResults = resultsByTeam.get(teamId) ?? [];
    const weeksPlayed = teamResults.length;
    const record = recordFromResults(teamResults);
    const avgScore =
      weeksPlayed > 0
        ? teamResults.reduce((sum, row) => sum + row.score, 0) / weeksPlayed
        : 0;
    const avgMov =
      weeksPlayed > 0
        ? teamResults.reduce((sum, row) => sum + row.mov, 0) / weeksPlayed
        : 0;

    const opponentPcts = teamResults.map(
      (row) =>
        ((winPctByTeam.get(row.opponentId) ?? 0) +
          (allPlayByTeam.get(row.opponentId) ?? 0)) /
        2,
    );
    const sos =
      opponentPcts.length > 0
        ? opponentPcts.reduce((sum, value) => sum + value, 0) /
          opponentPcts.length
        : 0;

    return {
      teamId,
      wins: record.wins,
      losses: record.losses,
      ties: record.ties,
      winPct: winPctByTeam.get(teamId) ?? 0,
      allPlayPct: allPlayByTeam.get(teamId) ?? 0,
      avgScore,
      avgMov,
      sos,
      weeksPlayed,
    };
  });

  const avgScores = stats.map((row) => row.avgScore);
  const sosValues = stats.map((row) => row.sos);

  const computed: PowerRankingComputed[] = stats.map((row) => {
    const scoringComponent = minMaxNormalize(avgScores, row.avgScore);
    const sosComponent = minMaxNormalize(sosValues, row.sos);
    const powerScore =
      WEIGHT_RECORD * row.winPct +
      WEIGHT_ALL_PLAY * row.allPlayPct +
      WEIGHT_SCORING * scoringComponent +
      WEIGHT_SOS * sosComponent;

    return {
      teamId: row.teamId,
      rank: 0,
      powerScore: Number(powerScore.toFixed(4)),
      sos: Number(row.sos.toFixed(4)),
      avgScore: row.avgScore,
      avgMov: row.avgMov,
      weeksPlayed: row.weeksPlayed,
      wins: row.wins,
      losses: row.losses,
      ties: row.ties,
    };
  });

  computed.sort((a, b) => {
    if (b.powerScore !== a.powerScore) return b.powerScore - a.powerScore;
    if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
    if (b.sos !== a.sos) return b.sos - a.sos;
    return a.teamId - b.teamId;
  });

  return computed.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

/** @deprecated Kept for older tests / imports — win-matrix helpers no longer drive rankings. */
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

/** @deprecated */
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

/** @deprecated */
export function twoStepDominance(winMatrix: number[][]): number[] {
  const combined = addMatrix(squareMatrix(winMatrix), winMatrix);
  return combined.map((row) => row.reduce((sum, value) => sum + value, 0));
}

/** @deprecated */
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
