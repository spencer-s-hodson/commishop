import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectActivePlayerIds,
  isPlayerOut,
  liveSideScore,
  parseNbaScoreboardProgress,
} from "@/server/espn/matchup-projections";

describe("isPlayerOut", () => {
  it("detects OUT / IR / suspension statuses", () => {
    assert.equal(isPlayerOut("OUT"), true);
    assert.equal(isPlayerOut("injury_reserve"), true);
    assert.equal(isPlayerOut("IR"), true);
    assert.equal(isPlayerOut("SUSPENSION"), true);
    assert.equal(isPlayerOut("QUESTIONABLE"), false);
    assert.equal(isPlayerOut(undefined), false);
  });
});

describe("liveSideScore", () => {
  it("prefers totalPointsLive then totalPoints", () => {
    assert.equal(
      liveSideScore({ totalPointsLive: 55.5, totalPoints: 40 }),
      55.5,
    );
    assert.equal(liveSideScore({ totalPoints: 40 }), 40);
  });

  it("sums active roster appliedStatTotal when scores missing", () => {
    assert.equal(
      liveSideScore({
        rosterForCurrentScoringPeriod: {
          entries: [
            {
              lineupSlotId: 0,
              playerPoolEntry: { appliedStatTotal: 10 },
            },
            {
              lineupSlotId: 12, // bench
              playerPoolEntry: { appliedStatTotal: 99 },
            },
            {
              lineupSlotId: 2,
              playerPoolEntry: { appliedStatTotal: 7 },
            },
          ],
        },
      }),
      17,
    );
  });
});

describe("collectActivePlayerIds", () => {
  it("skips bench / IR slots", () => {
    assert.deepEqual(
      collectActivePlayerIds({
        rosterForMatchupPeriod: {
          entries: [
            { lineupSlotId: 0, playerId: 1 },
            { lineupSlotId: 12, playerId: 2 },
            { lineupSlotId: 13, playerId: 3 },
            { lineupSlotId: 4, playerId: 4 },
          ],
        },
      }),
      [1, 4],
    );
  });
});

describe("parseNbaScoreboardProgress", () => {
  it("maps final / halftime / scheduled competitors", () => {
    const map = parseNbaScoreboardProgress({
      events: [
        {
          competitions: [
            {
              status: {
                type: { name: "STATUS_FINAL", completed: true },
                period: 4,
                clock: 0,
              },
              competitors: [{ team: { id: "1" } }, { team: { id: "2" } }],
            },
          ],
        },
        {
          competitions: [
            {
              status: {
                type: { name: "STATUS_HALFTIME" },
                period: 2,
                clock: 0,
              },
              competitors: [{ team: { id: "3" } }],
            },
          ],
        },
        {
          competitions: [
            {
              status: {
                type: { name: "STATUS_SCHEDULED" },
                period: 0,
                clock: 0,
              },
              competitors: [{ team: { id: "4" } }],
            },
          ],
        },
      ],
    });

    assert.equal(map.get(1)?.isFinal, true);
    assert.equal(map.get(1)?.remainingFraction, 0);
    assert.equal(map.get(3)?.remainingFraction, 0.5);
    assert.equal(map.get(4)?.hasStarted, false);
    assert.equal(map.get(4)?.remainingFraction, 1);
  });
});
