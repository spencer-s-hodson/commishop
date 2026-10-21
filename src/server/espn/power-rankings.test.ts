import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addMatrix,
  buildWinMatrix,
  computePowerRankings,
  squareMatrix,
  twoStepDominance,
  type PowerRankingWeeklyResult,
} from "./power-rankings";

describe("squareMatrix / addMatrix", () => {
  it("squares and adds 2x2 matrices", () => {
    const w = [
      [0, 1],
      [0, 0],
    ];
    const squared = squareMatrix(w);
    assert.deepEqual(squared, [
      [0, 0],
      [0, 0],
    ]);

    const summed = addMatrix(squared, w);
    assert.deepEqual(summed, [
      [0, 1],
      [0, 0],
    ]);
  });
});

describe("twoStepDominance", () => {
  it("rewards beating a team that also won (W² path)", () => {
    // Team 0 beat team 1; team 1 beat team 2.
    const winMatrix = [
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, 0],
    ];
    const dominance = twoStepDominance(winMatrix);
    // Team 0: direct win vs 1 + transitive win vs 2 via W² → higher than team 1
    assert.equal(dominance[0], 2); // row of W+W² = [0,1,1]
    assert.equal(dominance[1], 1); // [0,0,1]
    assert.equal(dominance[2], 0);
  });
});

describe("buildWinMatrix", () => {
  it("counts head-to-head wins across weeks", () => {
    const teamIds = [10, 20, 30];
    const results: PowerRankingWeeklyResult[] = [
      { teamId: 10, opponentId: 20, score: 100, mov: 10 },
      { teamId: 20, opponentId: 10, score: 90, mov: -10 },
      { teamId: 10, opponentId: 30, score: 110, mov: 5 },
      { teamId: 30, opponentId: 10, score: 105, mov: -5 },
      { teamId: 20, opponentId: 30, score: 95, mov: 15 },
      { teamId: 30, opponentId: 20, score: 80, mov: -15 },
    ];

    const matrix = buildWinMatrix(teamIds, results);
    // 10 beat 20 and 30 once each
    assert.deepEqual(matrix[0], [0, 1, 1]);
    // 20 beat 30 once
    assert.deepEqual(matrix[1], [0, 0, 1]);
    assert.deepEqual(matrix[2], [0, 0, 0]);
  });

  it("ignores ties (mov <= 0)", () => {
    const matrix = buildWinMatrix(
      [1, 2],
      [
        { teamId: 1, opponentId: 2, score: 50, mov: 0 },
        { teamId: 2, opponentId: 1, score: 50, mov: 0 },
      ],
    );
    assert.deepEqual(matrix, [
      [0, 0],
      [0, 0],
    ]);
  });
});

describe("computePowerRankings", () => {
  it("ranks a high-scoring loser above a low-scoring winner via avg score + dominance", () => {
    // Week 1: Team A (120) loses to Team B (125) — both crush everyone else style.
    // Week 1 also: Team C (80) beats Team D (70).
    // Without power rankings, C is 1-0 and A is 0-1.
    const teams = [{ teamId: 1 }, { teamId: 2 }, { teamId: 3 }, { teamId: 4 }];
    const results: PowerRankingWeeklyResult[] = [
      // A vs B
      { teamId: 1, opponentId: 2, score: 120, mov: -5 },
      { teamId: 2, opponentId: 1, score: 125, mov: 5 },
      // C vs D
      { teamId: 3, opponentId: 4, score: 80, mov: 10 },
      { teamId: 4, opponentId: 3, score: 70, mov: -10 },
    ];

    const rankings = computePowerRankings(teams, results);
    const byId = Object.fromEntries(rankings.map((row) => [row.teamId, row]));

    // B (won vs A) should be #1
    assert.equal(byId[2]!.rank, 1);
    // A scored 120 — should outrank low-scoring C (80) despite 0-1 vs 1-0
    assert.ok(byId[1]!.rank < byId[3]!.rank);
    assert.ok(byId[1]!.powerScore > byId[3]!.powerScore);
  });

  it("uses espnff-style truncated weights", () => {
    const rankings = computePowerRankings(
      [{ teamId: 1 }, { teamId: 2 }],
      [
        { teamId: 1, opponentId: 2, score: 100.9, mov: 10.9 },
        { teamId: 2, opponentId: 1, score: 90.1, mov: -10.9 },
      ],
    );

    const winner = rankings.find((row) => row.teamId === 1)!;
    // dominance = 1 (one win), avgScore trunc 100, avgMov trunc 10
    // power = 1*0.8 + 100*0.15 + 10*0.05 = 0.8 + 15 + 0.5 = 16.3
    assert.equal(winner.powerScore, 16.3);
    assert.equal(winner.rank, 1);
  });
});
