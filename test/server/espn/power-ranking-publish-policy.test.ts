import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluatePublishHourGate,
  matchupsEndingOn,
} from "@/server/espn/power-ranking-publish-policy";

describe("evaluatePublishHourGate", () => {
  it("skips outside Utah hour 10", () => {
    // 16:30 UTC in January = 9am MST
    const winterNine = new Date("2026-01-15T16:30:00.000Z");
    const result = evaluatePublishHourGate(winterNine);
    assert.equal(result.skipped, true);
    if (result.skipped) {
      assert.equal(result.hour, 9);
      assert.match(result.reason, /expected 10/);
    }
  });

  it("runs at Utah 10am in MDT and MST cron slots", () => {
    const summerTen = new Date("2026-07-15T16:30:00.000Z"); // 10 MDT
    const winterTen = new Date("2026-01-15T17:30:00.000Z"); // 10 MST

    const summer = evaluatePublishHourGate(summerTen);
    const winter = evaluatePublishHourGate(winterTen);

    assert.equal(summer.skipped, false);
    assert.equal(winter.skipped, false);
    if (!summer.skipped && !winter.skipped) {
      assert.equal(summer.hour, 10);
      assert.equal(winter.hour, 10);
      assert.equal(summer.yesterday, "2026-07-14");
      assert.equal(winter.yesterday, "2026-01-14");
    }
  });

  it("force bypasses the hour gate", () => {
    const winterNine = new Date("2026-01-15T16:30:00.000Z");
    const result = evaluatePublishHourGate(winterNine, { force: true });
    assert.equal(result.skipped, false);
    if (!result.skipped) {
      assert.equal(result.yesterday, "2026-01-14");
    }
  });
});

describe("matchupsEndingOn", () => {
  it("returns only periods whose endDate is yesterday", () => {
    const matched = matchupsEndingOn(
      [
        { matchupPeriodId: 1, endDate: "2026-10-19", label: "Matchup 1" },
        { matchupPeriodId: 2, endDate: "2026-10-26", label: "Matchup 2" },
        { matchupPeriodId: 3, endDate: null, label: "Matchup 3" },
      ],
      "2026-10-19",
    );
    assert.deepEqual(
      matched.map((m) => m.matchupPeriodId),
      [1],
    );
  });

  it("returns empty when no period ended yesterday", () => {
    assert.deepEqual(
      matchupsEndingOn(
        [{ matchupPeriodId: 1, endDate: "2026-10-19" }],
        "2026-10-20",
      ),
      [],
    );
  });
});
