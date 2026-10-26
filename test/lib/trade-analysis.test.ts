import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyzeTrade,
  gradeForScore,
  optimalLineup,
  rebalanceRoster,
  type TradePlayer,
  type TradeTeam,
} from "@/lib/trade-analysis";

const GUARD = [0, 1, 5, 11, 12, 13];
const WING = [2, 3, 6, 11, 12, 13];
const BIG = [4, 11, 12, 13];

let nextId = 1;
function player(
  ppg: number,
  eligibleSlots: number[],
  overrides: Partial<TradePlayer> = {},
): TradePlayer {
  const id = nextId++;
  return {
    id,
    name: `P${id}`,
    proTeam: "BOS",
    positions: [],
    eligibleSlots,
    lineupSlotId: 12,
    injuryStatus: null,
    ppg,
    projectedPpg: ppg,
    seasonPpg: null,
    seasonGamesPlayed: 0,
    recentPpg: null,
    availability: 1,
    gamesRemaining: 70,
    restOfSeasonPoints: ppg * 70,
    value: ppg,
    ...overrides,
  };
}

function team(id: number, players: TradePlayer[]): TradeTeam {
  return {
    id,
    name: `Team ${id}`,
    abbrev: `T${id}`,
    logoUrl: null,
    ownerName: null,
    wins: 0,
    losses: 0,
    ties: 0,
    players,
  };
}

describe("optimalLineup", () => {
  it("respects slot eligibility instead of just taking the top scorers", () => {
    // One C slot + one UTIL: three guards can't all start.
    const players = [player(50, GUARD), player(45, GUARD), player(20, BIG)];
    const { starters, strength } = optimalLineup(players, [4, 11]);
    assert.equal(starters.length, 2);
    assert.equal(strength, 70);
  });

  it("reshuffles earlier picks to seat a later player (augmenting path)", () => {
    // UTIL then C: greedy-by-slot would put the big in UTIL first.
    const big = player(60, BIG);
    const guard = player(40, GUARD);
    const { strength } = optimalLineup([big, guard], [11, 4]);
    assert.equal(strength, 100);
  });
});

describe("rebalanceRoster", () => {
  it("drops the weakest incumbent on a 2-for-1", () => {
    const keep = player(40, GUARD);
    const weak = player(10, GUARD);
    const outgoing = player(30, WING);
    const incoming = [player(25, WING), player(24, BIG)];
    const { roster, drops } = rebalanceRoster({
      roster: [keep, weak, outgoing],
      outgoing: [outgoing],
      incoming,
      activeRosterLimit: 3,
      freeAgentPool: [],
    });
    assert.deepEqual(
      drops.map((p) => p.id),
      [weak.id],
    );
    assert.equal(roster.length, 3);
  });

  it("picks up the best free agent when sending more than receiving", () => {
    const a = player(40, GUARD);
    const b = player(30, WING);
    const freeAgent = player(15, BIG);
    const { roster, pickups } = rebalanceRoster({
      roster: [a, b],
      outgoing: [a, b],
      incoming: [player(50, GUARD)],
      activeRosterLimit: 2,
      freeAgentPool: [freeAgent],
    });
    assert.deepEqual(
      pickups.map((p) => p.id),
      [freeAgent.id],
    );
    assert.equal(roster.length, 2);
  });

  it("doesn't count IR-slot players against the active limit", () => {
    const injured = player(35, BIG, { lineupSlotId: 13 });
    const { drops } = rebalanceRoster({
      roster: [player(20, GUARD), injured],
      outgoing: [],
      incoming: [],
      activeRosterLimit: 1,
      freeAgentPool: [],
    });
    assert.equal(drops.length, 0);
  });
});

describe("analyzeTrade", () => {
  const slots = [0, 4, 11];
  const context = { starterSlots: slots, activeRosterLimit: 3, freeAgents: [] };

  it("calls an even swap fair", () => {
    const aGuard = player(30, GUARD);
    const bGuard = player(30, GUARD);
    const a = team(1, [aGuard, player(25, BIG), player(20, WING)]);
    const b = team(2, [bGuard, player(25, BIG), player(20, WING)]);
    const result = analyzeTrade({
      sideA: { team: a, sendingIds: [aGuard.id] },
      sideB: { team: b, sendingIds: [bGuard.id] },
      allTeams: [a, b],
      context,
    });
    assert.equal(result.verdict.kind, "fair");
    assert.equal(result.sides[0].grade, "B");
  });

  it("favors the side that lands the clearly better player", () => {
    const star = player(55, GUARD, { value: 100 });
    const scrub = player(18, GUARD, { value: 5 });
    const a = team(1, [scrub, player(25, BIG), player(20, WING)]);
    const b = team(2, [star, player(25, BIG), player(20, WING)]);
    const result = analyzeTrade({
      sideA: { team: a, sendingIds: [scrub.id] },
      sideB: { team: b, sendingIds: [star.id] },
      allTeams: [a, b],
      context,
    });
    assert.equal(result.verdict.winnerTeamId, 1);
    assert.equal(result.verdict.kind, "lopsided");
    assert.ok(result.sides[0].lineupAfter > result.sides[0].lineupBefore);
    assert.equal(result.sides[0].lineupRankAfter, 1);
    assert.equal(result.sides[1].grade, "F");
  });

  it("maps scores onto letter grades", () => {
    assert.equal(gradeForScore(0.5), "A+");
    assert.equal(gradeForScore(0), "B");
    assert.equal(gradeForScore(-0.9), "F");
  });
});
