import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allPlayWinPctByTeam,
  computePowerRankings,
  minMaxNormalize,
  type PowerRankingWeeklyResult,
} from "@/server/espn/power-rankings";

describe("minMaxNormalize", () => {
  it("maps min to 0 and max to 1", () => {
    assert.equal(minMaxNormalize([10, 20, 30], 10), 0);
    assert.equal(minMaxNormalize([10, 20, 30], 30), 1);
    assert.equal(minMaxNormalize([10, 20, 30], 20), 0.5);
  });

  it("returns 0.5 when all values are equal", () => {
    assert.equal(minMaxNormalize([5, 5, 5], 5), 0.5);
  });
});

describe("computePowerRankings", () => {
  it("ranks undefeated soft-schedule team below a tested high scorer", () => {
    // A: 2-0 vs weak D/E (low SOS), modest scoring
    // B: 1-1 vs strong A/C, high scoring
    // C: 1-1 mid
    // D, E: 0-2 punching bags
    const teams = [
      { teamId: 1 },
      { teamId: 2 },
      { teamId: 3 },
      { teamId: 4 },
      { teamId: 5 },
    ];
    const results: PowerRankingWeeklyResult[] = [
      // Week 1: A beats D, B beats C, E loses to… wait need pairs
      // A 120 vs D 80
      { period: 1, teamId: 1, opponentId: 4, score: 120, mov: 40 },
      { period: 1, teamId: 4, opponentId: 1, score: 80, mov: -40 },
      // B 150 vs C 140
      { period: 1, teamId: 2, opponentId: 3, score: 150, mov: 10 },
      { period: 1, teamId: 3, opponentId: 2, score: 140, mov: -10 },
      // Week 2: A beats E, B loses to C (but both score high)
      { period: 2, teamId: 1, opponentId: 5, score: 115, mov: 35 },
      { period: 2, teamId: 5, opponentId: 1, score: 80, mov: -35 },
      { period: 2, teamId: 2, opponentId: 3, score: 155, mov: -5 },
      { period: 2, teamId: 3, opponentId: 2, score: 160, mov: 5 },
    ];

    const rankings = computePowerRankings(teams, results);
    const byId = Object.fromEntries(rankings.map((row) => [row.teamId, row]));

    assert.equal(byId[1]!.wins, 2);
    assert.equal(byId[1]!.losses, 0);
    assert.ok(byId[1]!.sos < byId[2]!.sos);
    // High-scoring B with tougher slate should outrank soft-schedule A
    // despite worse record — SOS + PF matter.
    assert.ok(
      byId[2]!.rank <= byId[1]!.rank,
      `expected B rank (${byId[2]!.rank}) <= A rank (${byId[1]!.rank})`,
    );
  });

  it("rewards high points for over tiny margins", () => {
    const teams = [{ teamId: 1 }, { teamId: 2 }, { teamId: 3 }, { teamId: 4 }];
    const results: PowerRankingWeeklyResult[] = [
      // A barely beats B but both score huge; C squeaks past D with low scores
      { period: 1, teamId: 1, opponentId: 2, score: 700, mov: 5 },
      { period: 1, teamId: 2, opponentId: 1, score: 695, mov: -5 },
      { period: 1, teamId: 3, opponentId: 4, score: 400, mov: 20 },
      { period: 2, teamId: 4, opponentId: 3, score: 380, mov: -20 },
    ];

    const rankings = computePowerRankings(teams, results);
    const byId = Object.fromEntries(rankings.map((row) => [row.teamId, row]));

    // A wins + huge PF should beat C's win with low PF
    assert.ok(byId[1]!.rank < byId[3]!.rank);
    // B (lost but scored 695) should outrank low-scoring winner C
    assert.ok(byId[2]!.rank < byId[3]!.rank);
  });

  it("week 1: a loser with the 2nd-best score outranks a low-scoring winner", () => {
    // 6 teams, one week. Scores: A 180 (beat B), B 175 (lost to A),
    // C 120 (beat D 110), E 150 (beat F 100). C won with the 4th-best score.
    const teams = [1, 2, 3, 4, 5, 6].map((teamId) => ({ teamId }));
    const results: PowerRankingWeeklyResult[] = [
      { period: 1, teamId: 1, opponentId: 2, score: 180, mov: 5 },
      { period: 1, teamId: 2, opponentId: 1, score: 175, mov: -5 },
      { period: 1, teamId: 3, opponentId: 4, score: 120, mov: 10 },
      { period: 1, teamId: 4, opponentId: 3, score: 110, mov: -10 },
      { period: 1, teamId: 5, opponentId: 6, score: 150, mov: 50 },
      { period: 1, teamId: 6, opponentId: 5, score: 100, mov: -50 },
    ];

    const rankings = computePowerRankings(teams, results);
    const byId = Object.fromEntries(rankings.map((row) => [row.teamId, row]));

    assert.ok(byId[2]!.rank < byId[3]!.rank);
    // Losing to the top scorer is a tougher schedule than losing to C.
    assert.ok(byId[2]!.sos > byId[4]!.sos);
  });
});

describe("allPlayWinPctByTeam", () => {
  it("scores each week against every other team", () => {
    const allPlay = allPlayWinPctByTeam([
      { period: 1, teamId: 1, opponentId: 2, score: 100, mov: 10 },
      { period: 1, teamId: 2, opponentId: 1, score: 90, mov: -10 },
      { period: 1, teamId: 3, opponentId: 4, score: 95, mov: 15 },
      { period: 1, teamId: 4, opponentId: 3, score: 80, mov: -15 },
      { period: 2, teamId: 1, opponentId: 3, score: 50, mov: -10 },
      { period: 2, teamId: 3, opponentId: 1, score: 60, mov: 10 },
    ]);
    // Week 1: 3/3. Week 2: 0/1. Average 0.5.
    assert.equal(allPlay.get(1), 0.5);
    assert.equal(allPlay.get(2), 1 / 3);
    assert.equal(allPlay.get(4), 0);
  });
});
