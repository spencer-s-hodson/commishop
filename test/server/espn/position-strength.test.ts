import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  eligibleFantasyPositions,
  rankDescending,
  topNProjectedPpgSum,
} from "@/server/espn/position-strength";

describe("eligibleFantasyPositions", () => {
  it("uses eligibleSlots so multi-pos players count at every fillable slot", () => {
    // PG + SG + G + UTIL style eligibility
    assert.deepEqual(
      eligibleFantasyPositions({
        eligibleSlots: [0, 1, 5, 11],
        defaultPositionId: 1,
      }),
      ["PG", "SG"],
    );
  });

  it("includes PF and C when both slots are eligible", () => {
    assert.deepEqual(
      eligibleFantasyPositions({
        eligibleSlots: [3, 4, 9, 11],
        defaultPositionId: 5,
      }),
      ["PF", "C"],
    );
  });

  it("falls back to defaultPositionId when eligibleSlots are missing", () => {
    assert.deepEqual(
      eligibleFantasyPositions({ defaultPositionId: 4 }),
      ["PF"],
    );
    assert.deepEqual(eligibleFantasyPositions({}), []);
  });
});

describe("topNProjectedPpgSum", () => {
  it("sums only the top N values", () => {
    assert.equal(topNProjectedPpgSum([10, 40, 20, 30], 3), 90);
    assert.equal(topNProjectedPpgSum([5, 5], 3), 10);
    assert.equal(topNProjectedPpgSum([], 3), 0);
  });

  it("does not reward a long tail of mediocre players vs three strong ones", () => {
    const deepButWeak = topNProjectedPpgSum([8, 8, 8, 8, 8, 8, 8], 3);
    const threeStrong = topNProjectedPpgSum([30, 25, 20], 3);
    assert.ok(threeStrong > deepButWeak);
  });
});

describe("rankDescending", () => {
  it("ranks higher scores better (1 = best)", () => {
    const league = [50, 80, 20];
    assert.equal(rankDescending(league, 80), 1);
    assert.equal(rankDescending(league, 50), 2);
    assert.equal(rankDescending(league, 20), 3);
  });
});
