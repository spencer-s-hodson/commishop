import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  espnYesterdayYmd,
  hourInTimeZone,
  utahHour,
  yesterdayYmdInTimeZone,
  ymdInTimeZone,
} from "@/server/espn/power-ranking-publish-policy";

describe("timezone helpers", () => {
  it("formats YMD in the requested zone", () => {
    const instant = new Date("2026-03-08T15:30:00.000Z");
    assert.equal(ymdInTimeZone("America/New_York", instant), "2026-03-08");
    assert.equal(ymdInTimeZone("America/Denver", instant), "2026-03-08");
  });

  it("computes yesterday via calendar math across DST spring forward", () => {
    const afterSpring = new Date("2026-03-09T18:00:00.000Z");
    assert.equal(ymdInTimeZone("America/Denver", afterSpring), "2026-03-09");
    assert.equal(
      yesterdayYmdInTimeZone("America/Denver", afterSpring),
      "2026-03-08",
    );
    assert.equal(espnYesterdayYmd(afterSpring), "2026-03-08");
  });

  it("computes yesterday across DST fall back", () => {
    const afterFall = new Date("2026-11-01T20:00:00.000Z");
    assert.equal(ymdInTimeZone("America/Denver", afterFall), "2026-11-01");
    assert.equal(
      yesterdayYmdInTimeZone("America/Denver", afterFall),
      "2026-10-31",
    );
  });

  it("maps the MDT and MST cron slots to Utah hour 10", () => {
    const summerSlot = new Date("2026-07-15T16:30:00.000Z");
    const winterSlot = new Date("2026-01-15T17:30:00.000Z");
    const summerOff = new Date("2026-07-15T17:30:00.000Z");
    const winterOff = new Date("2026-01-15T16:30:00.000Z");
    assert.equal(utahHour(summerSlot), 10);
    assert.equal(utahHour(winterSlot), 10);
    assert.equal(utahHour(summerOff), 11);
    assert.equal(utahHour(winterOff), 9);
    assert.equal(hourInTimeZone("America/Denver", summerSlot), 10);
    assert.equal(hourInTimeZone("America/Denver", winterSlot), 10);
  });
});
