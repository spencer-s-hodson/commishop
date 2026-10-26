import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  espnStyleWinProbability,
  normalCdf,
} from "@/server/espn/win-probability";

describe("normalCdf", () => {
  it("is ~0.5 at 0 and symmetric", () => {
    assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-4);
    assert.ok(Math.abs(normalCdf(1) + normalCdf(-1) - 1) < 1e-4);
  });
});

describe("espnStyleWinProbability", () => {
  it("returns 0.5 when both projections are zero", () => {
    assert.equal(
      espnStyleWinProbability({
        teamProjected: 0,
        teamCeiling: 0,
        opponentProjected: 0,
        opponentCeiling: 0,
        minutesOrGamesRemaining: true,
      }),
      0.5,
    );
  });

  it("favors the higher projection when spreads exist", () => {
    const p = espnStyleWinProbability({
      teamProjected: 120,
      teamCeiling: 140,
      opponentProjected: 100,
      opponentCeiling: 120,
      minutesOrGamesRemaining: true,
    });
    assert.ok(p > 0.5);
    assert.ok(p <= 0.98);
    assert.ok(p >= 0.02);
  });

  it("clamps to max/min when sd is zero and margin is nonzero", () => {
    assert.equal(
      espnStyleWinProbability({
        teamProjected: 110,
        teamCeiling: 110,
        opponentProjected: 100,
        opponentCeiling: 100,
        minutesOrGamesRemaining: true,
      }),
      0.98,
    );
    assert.equal(
      espnStyleWinProbability({
        teamProjected: 90,
        teamCeiling: 90,
        opponentProjected: 100,
        opponentCeiling: 100,
        minutesOrGamesRemaining: true,
      }),
      0.02,
    );
  });

  it("returns 100/0 once no games remain", () => {
    assert.equal(
      espnStyleWinProbability({
        teamProjected: 110,
        teamCeiling: 110,
        opponentProjected: 100,
        opponentCeiling: 100,
        minutesOrGamesRemaining: false,
      }),
      1,
    );
    assert.equal(
      espnStyleWinProbability({
        teamProjected: 90,
        teamCeiling: 90,
        opponentProjected: 100,
        opponentCeiling: 100,
        minutesOrGamesRemaining: false,
      }),
      0,
    );
  });
});
