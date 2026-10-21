import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMatchupPeriodOptions,
  effectiveScoringPeriodId,
  scoringPeriodDayTs,
  scoringPeriodsForMatchup,
  type EspnGameConstants,
} from "@/server/espn/scoring-periods";

/** Mon Oct 13 2025 00:00 ET → through Sun Oct 19 (approx via UTC stamps). */
const DAY = 24 * 60 * 60 * 1000;
const week1Start = Date.UTC(2025, 9, 13, 4, 0, 0); // ~midnight ET

function constantsFixture(): EspnGameConstants {
  const scoringPeriods = [];
  for (let i = 0; i < 14; i++) {
    const start = week1Start + i * DAY;
    scoringPeriods.push({
      id: i + 1,
      startDate: start,
      endDate: start + DAY,
    });
  }
  return {
    scoringPeriods,
    weeklyPeriods: [
      { id: 1, scoringPeriodStart: 1, scoringPeriodEnd: 7 },
      { id: 2, scoringPeriodStart: 8, scoringPeriodEnd: 14 },
    ],
  };
}

describe("scoringPeriodDayTs", () => {
  it("uses startDate for normal day-length periods", () => {
    const start = week1Start;
    assert.equal(
      scoringPeriodDayTs({ id: 1, startDate: start, endDate: start + DAY }),
      start,
    );
  });

  it("uses endDate - 1 day for long opening periods", () => {
    const start = week1Start;
    const end = start + 3 * DAY;
    assert.equal(
      scoringPeriodDayTs({ id: 1, startDate: start, endDate: end }),
      end - DAY,
    );
  });
});

describe("scoringPeriodsForMatchup", () => {
  it("expands weekly period ids into daily scoring periods", () => {
    const ids = scoringPeriodsForMatchup({
      matchupPeriodId: 1,
      constants: constantsFixture(),
      matchupPeriods: { "1": [1], "2": [2] },
    });
    assert.deepEqual(ids, [1, 2, 3, 4, 5, 6, 7]);
  });

  it("supports multi-week playoff map entries", () => {
    const ids = scoringPeriodsForMatchup({
      matchupPeriodId: 20,
      constants: constantsFixture(),
      matchupPeriods: { "20": [1, 2] },
    });
    assert.deepEqual(ids, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });
});

describe("buildMatchupPeriodOptions", () => {
  it("labels regular and playoff weeks and sets Eastern endDate", () => {
    const options = buildMatchupPeriodOptions({
      constants: constantsFixture(),
      matchupPeriods: { "1": [1], "2": [2], "20": [2] },
      matchupPeriodCount: 19,
    });

    assert.equal(options.length, 3);
    const match1 = options.find((o) => o.matchupPeriodId === 1)!;
    const playoff = options.find((o) => o.matchupPeriodId === 20)!;

    assert.match(match1.shortLabel, /Matchup 1/);
    assert.ok(match1.endDate);
    // Last day of week 1 scoring periods (id 7) in America/New_York
    assert.equal(match1.endDate, "2025-10-19");

    assert.match(playoff.shortLabel, /Playoffs/);
    assert.ok(playoff.endDate);
  });

  it("falls back to sequential ids when matchupPeriods is empty", () => {
    const options = buildMatchupPeriodOptions({
      constants: constantsFixture(),
      matchupPeriodCount: 2,
    });
    assert.deepEqual(
      options.map((o) => o.matchupPeriodId),
      [1, 2],
    );
  });
});

describe("effectiveScoringPeriodId", () => {
  it("uses live id when viewing the current week and live is in-week", () => {
    assert.equal(
      effectiveScoringPeriodId({
        selectedMatchupPeriodId: 2,
        currentMatchupPeriodId: 2,
        liveScoringPeriodId: 10,
        weekScoringPeriodIds: [8, 9, 10, 11],
      }),
      10,
    );
  });

  it("uses the last scoring period for past weeks", () => {
    assert.equal(
      effectiveScoringPeriodId({
        selectedMatchupPeriodId: 1,
        currentMatchupPeriodId: 2,
        liveScoringPeriodId: 10,
        weekScoringPeriodIds: [1, 2, 3, 4, 5, 6, 7],
      }),
      7,
    );
  });

  it("uses the first scoring period for future weeks", () => {
    assert.equal(
      effectiveScoringPeriodId({
        selectedMatchupPeriodId: 3,
        currentMatchupPeriodId: 2,
        liveScoringPeriodId: 10,
        weekScoringPeriodIds: [15, 16, 17, 18, 19, 20, 21],
      }),
      15,
    );
  });
});
