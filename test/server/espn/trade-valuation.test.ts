import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  injuryAvailability,
  rawTradeValue,
  replacementLevelPpg,
  valuePlayer,
} from "@/server/espn/trade-valuation";

const YEAR = 2027;

describe("valuePlayer", () => {
  it("uses ESPN's projection before any games are played", () => {
    const valuation = valuePlayer({
      stats: [
        {
          id: `10${YEAR}`,
          appliedAverage: 40,
          appliedTotal: 2952,
          stats: { "42": 73.8 },
        },
        { id: `00${YEAR}`, appliedAverage: 0, appliedTotal: 0 },
      ],
      seasonYear: YEAR,
      teamGamesRemaining: 80,
    });
    assert.equal(valuation.source, "projection");
    assert.equal(valuation.ppg, 40);
    assert.ok(Math.abs(valuation.gamesRemaining - 72) < 0.01);
  });

  it("shrinks the season line toward the projection on small samples", () => {
    const valuation = valuePlayer({
      stats: [
        { id: `10${YEAR}`, appliedAverage: 30, stats: { "42": 82 } },
        {
          id: `00${YEAR}`,
          appliedAverage: 45,
          appliedTotal: 225,
          stats: { "42": 5 },
        },
      ],
      seasonYear: YEAR,
      teamGamesRemaining: 70,
    });
    // 5 GP → weight 5/20 = 0.25 → 30*0.75 + 45*0.25
    assert.equal(valuation.source, "blend");
    assert.ok(Math.abs(valuation.ppg - 33.75) < 1e-9);
  });

  it("falls back to last season when there is no projection", () => {
    const valuation = valuePlayer({
      stats: [{ id: `00${YEAR - 1}`, appliedAverage: 22, stats: { "42": 41 } }],
      seasonYear: YEAR,
      teamGamesRemaining: 82,
    });
    assert.equal(valuation.source, "prior");
    assert.equal(valuation.ppg, 22);
    assert.ok(Math.abs(valuation.gamesRemaining - 41) < 0.01);
  });

  it("trims expected games for injured players", () => {
    const healthy = valuePlayer({
      stats: [{ id: `10${YEAR}`, appliedAverage: 30, stats: { "42": 82 } }],
      seasonYear: YEAR,
      teamGamesRemaining: 80,
    });
    const out = valuePlayer({
      stats: [{ id: `10${YEAR}`, appliedAverage: 30, stats: { "42": 82 } }],
      seasonYear: YEAR,
      injuryStatus: "OUT",
      teamGamesRemaining: 80,
    });
    assert.ok(out.restOfSeasonPoints < healthy.restOfSeasonPoints);
    assert.equal(injuryAvailability("ACTIVE"), 1);
    assert.equal(injuryAvailability("injury reserve"), 0.5);
  });
});

describe("trade value", () => {
  it("is zero at or below replacement level", () => {
    assert.equal(
      rawTradeValue({ ppg: 20, gamesRemaining: 70, replacementPpg: 25 }),
      0,
    );
  });

  it("gives one star more value than two players with the same total surplus", () => {
    const star = rawTradeValue({
      ppg: 45,
      gamesRemaining: 70,
      replacementPpg: 25,
    });
    const depth =
      2 * rawTradeValue({ ppg: 35, gamesRemaining: 70, replacementPpg: 25 });
    assert.ok(star > depth);
  });

  it("averages the best free agents for replacement level", () => {
    assert.equal(replacementLevelPpg([10, 30, 28, 26, 24, 22, 0], 5), 26);
    assert.equal(replacementLevelPpg([]), 0);
  });
});
