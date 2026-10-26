/**
 * Two-team trade analysis. Pure so it can run client-side as players are
 * toggled; the server only supplies a valued snapshot of every roster.
 *
 * Lineup slot ids follow ESPN: 0=PG 1=SG 2=SF 3=PF 4=C 5=G 6=F 11=UTIL,
 * 12=bench, 13=IR.
 */

export const BENCH_SLOT_ID = 12;
export const IR_SLOT_ID = 13;

export const TRADE_POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
export type TradePosition = (typeof TRADE_POSITIONS)[number];

export type TradePlayer = {
  id: number;
  name: string;
  proTeam: string;
  positions: TradePosition[];
  eligibleSlots: number[];
  lineupSlotId: number | null;
  injuryStatus: string | null;
  ppg: number;
  projectedPpg: number | null;
  seasonPpg: number | null;
  seasonGamesPlayed: number;
  recentPpg: number | null;
  availability: number;
  gamesRemaining: number;
  restOfSeasonPoints: number;
  /** 0–100 league-relative trade value (100 = most valuable rostered player). */
  value: number;
};

export type TradeTeam = {
  id: number;
  name: string;
  abbrev: string;
  logoUrl: string | null;
  ownerName: string | null;
  wins: number;
  losses: number;
  ties: number;
  players: TradePlayer[];
};

export type TradeLeagueContext = {
  /** Starting slots expanded (e.g. three UTIL → [11, 11, 11]). */
  starterSlots: number[];
  /** Max players outside the IR slot. */
  activeRosterLimit: number;
  /** Best available free agents, PPG descending. */
  freeAgents: TradePlayer[];
};

export type TradeSide = {
  team: TradeTeam;
  /** Player ids this team sends away. */
  sendingIds: number[];
};

/** Expected fantasy points per game played, after injury haircut. */
export function lineupWeight(player: TradePlayer) {
  return player.ppg * player.availability;
}

/**
 * Best legal starting lineup by slot eligibility.
 *
 * Players-to-slots is a transversal matroid, so greedily adding the
 * highest-weight player whenever an augmenting path still seats everyone is
 * optimal.
 */
export function optimalLineup(players: TradePlayer[], starterSlots: number[]) {
  const sorted = [...players].sort((a, b) => lineupWeight(b) - lineupWeight(a));
  const slotOwner: Array<TradePlayer | null> = starterSlots.map(() => null);

  const tryPlace = (player: TradePlayer, visited: Set<number>): boolean => {
    for (let index = 0; index < starterSlots.length; index++) {
      if (visited.has(index)) continue;
      if (!player.eligibleSlots.includes(starterSlots[index]!)) continue;
      visited.add(index);
      const owner = slotOwner[index];
      if (!owner || tryPlace(owner, visited)) {
        slotOwner[index] = player;
        return true;
      }
    }
    return false;
  };

  for (const player of sorted) {
    if (slotOwner.every(Boolean)) break;
    tryPlace(player, new Set());
  }

  const starters = slotOwner.filter((player): player is TradePlayer =>
    Boolean(player),
  );
  return {
    starters,
    strength: starters.reduce((sum, player) => sum + lineupWeight(player), 0),
  };
}

export function positionDepth(players: TradePlayer[]) {
  const depth = Object.fromEntries(
    TRADE_POSITIONS.map((position) => [position, 0]),
  ) as Record<TradePosition, number>;
  for (const player of players) {
    for (const position of player.positions) depth[position] += 1;
  }
  return depth;
}

function isActive(player: TradePlayer) {
  return player.lineupSlotId !== IR_SLOT_ID;
}

/**
 * Apply incoming/outgoing players, then force the roster back to the active
 * limit: drop the weakest incumbents, or pick up the best free agents.
 */
export function rebalanceRoster(input: {
  roster: TradePlayer[];
  outgoing: TradePlayer[];
  incoming: TradePlayer[];
  activeRosterLimit: number;
  freeAgentPool: TradePlayer[];
}) {
  const outgoingIds = new Set(input.outgoing.map((player) => player.id));
  const incomingIds = new Set(input.incoming.map((player) => player.id));
  // Incoming players arrive in an active slot regardless of prior IR status.
  const incoming = input.incoming.map((player) => ({
    ...player,
    lineupSlotId: BENCH_SLOT_ID,
  }));
  let roster = [
    ...input.roster.filter((player) => !outgoingIds.has(player.id)),
    ...incoming,
  ];

  const drops: TradePlayer[] = [];
  const pickups: TradePlayer[] = [];

  let overflow = roster.filter(isActive).length - input.activeRosterLimit;
  if (overflow > 0) {
    const droppable = roster
      .filter((player) => isActive(player) && !incomingIds.has(player.id))
      .sort((a, b) => a.restOfSeasonPoints - b.restOfSeasonPoints);
    for (const player of droppable) {
      if (overflow <= 0) break;
      drops.push(player);
      overflow -= 1;
    }
    const dropIds = new Set(drops.map((player) => player.id));
    roster = roster.filter((player) => !dropIds.has(player.id));
  } else if (overflow < 0) {
    for (const freeAgent of input.freeAgentPool.slice(0, -overflow)) {
      pickups.push({ ...freeAgent, lineupSlotId: BENCH_SLOT_ID });
    }
    roster = [...roster, ...pickups];
  }

  return { roster, drops, pickups };
}

export type TradeTeamImpact = {
  team: TradeTeam;
  receives: TradePlayer[];
  sends: TradePlayer[];
  drops: TradePlayer[];
  pickups: TradePlayer[];
  valueIn: number;
  valueOut: number;
  /** Rest-of-season fantasy points, whole roster after forced moves. */
  restOfSeasonDelta: number;
  lineupBefore: number;
  lineupAfter: number;
  lineupRankBefore: number;
  lineupRankAfter: number;
  depthBefore: Record<TradePosition, number>;
  depthAfter: Record<TradePosition, number>;
  /** Positions where the team drops to one or zero eligible players. */
  thinPositions: TradePosition[];
  score: number;
  grade: string;
};

export type TradeVerdict = {
  kind: "fair" | "edge" | "win" | "lopsided";
  winnerTeamId: number | null;
  headline: string;
};

export type TradeAnalysis = {
  sides: [TradeTeamImpact, TradeTeamImpact];
  verdict: TradeVerdict;
};

const VALUE_WEIGHT = 0.6;
const LINEUP_WEIGHT = 0.4;
/** A lineup swing this large (share of starting strength) maxes out its score. */
const LINEUP_FULL_SWING = 0.06;

const GRADE_THRESHOLDS: Array<[number, string]> = [
  [0.3, "A+"],
  [0.18, "A"],
  [0.1, "A-"],
  [0.04, "B+"],
  [-0.04, "B"],
  [-0.1, "C+"],
  [-0.18, "C"],
  [-0.3, "D"],
];

export function gradeForScore(score: number) {
  for (const [threshold, grade] of GRADE_THRESHOLDS) {
    if (score >= threshold) return grade;
  }
  return "F";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sumBy(players: TradePlayer[], pick: (player: TradePlayer) => number) {
  return players.reduce((sum, player) => sum + pick(player), 0);
}

/** 1-based rank of `strength` among the other teams' baseline strengths. */
function rankAmong(strength: number, others: number[]) {
  return others.filter((other) => other > strength).length + 1;
}

export function analyzeTrade(input: {
  sideA: TradeSide;
  sideB: TradeSide;
  allTeams: TradeTeam[];
  context: TradeLeagueContext;
}): TradeAnalysis {
  const { sideA, sideB, allTeams, context } = input;

  const baselineByTeam = new Map(
    allTeams.map((team) => [
      team.id,
      optimalLineup(team.players, context.starterSlots).strength,
    ]),
  );

  const pick = (team: TradeTeam, ids: number[]) =>
    team.players.filter((player) => ids.includes(player.id));
  const sendsA = pick(sideA.team, sideA.sendingIds);
  const sendsB = pick(sideB.team, sideB.sendingIds);

  const otherBaselines = (teamId: number, partnerId: number | null) =>
    [...baselineByTeam]
      .filter(([id]) => id !== teamId && id !== partnerId)
      .map(([, strength]) => strength);

  const claimedFreeAgents = new Set<number>();
  const impactFor = (
    team: TradeTeam,
    sends: TradePlayer[],
    receives: TradePlayer[],
  ): TradeTeamImpact => {
    const { roster, drops, pickups } = rebalanceRoster({
      roster: team.players,
      outgoing: sends,
      incoming: receives,
      activeRosterLimit: context.activeRosterLimit,
      freeAgentPool: context.freeAgents.filter(
        (player) => !claimedFreeAgents.has(player.id),
      ),
    });
    for (const player of pickups) claimedFreeAgents.add(player.id);

    const lineupBefore = baselineByTeam.get(team.id) ?? 0;
    const lineupAfter = optimalLineup(roster, context.starterSlots).strength;

    const valueIn = sumBy(receives, (player) => player.value);
    const valueOut = sumBy(sends, (player) => player.value);
    const restOfSeasonDelta =
      sumBy(roster, (player) => player.restOfSeasonPoints) -
      sumBy(team.players, (player) => player.restOfSeasonPoints);

    const depthBefore = positionDepth(team.players.filter(isActive));
    const depthAfter = positionDepth(roster.filter(isActive));
    const thinPositions = TRADE_POSITIONS.filter(
      (position) =>
        depthAfter[position] <= 1 &&
        depthAfter[position] < depthBefore[position],
    );

    const valueEdge =
      valueIn === 0 && valueOut === 0
        ? 0
        : (valueIn - valueOut) / Math.max(valueIn, valueOut);
    const lineupEdge =
      lineupBefore > 0
        ? clamp(
            (lineupAfter - lineupBefore) / (lineupBefore * LINEUP_FULL_SWING),
            -1,
            1,
          )
        : 0;
    const score = VALUE_WEIGHT * valueEdge + LINEUP_WEIGHT * lineupEdge;

    return {
      team,
      receives,
      sends,
      drops,
      pickups,
      valueIn,
      valueOut,
      restOfSeasonDelta,
      lineupBefore,
      lineupAfter,
      lineupRankBefore: rankAmong(lineupBefore, otherBaselines(team.id, null)),
      // Filled in once both sides are known (depends on the partner's result).
      lineupRankAfter: 0,
      depthBefore,
      depthAfter,
      thinPositions,
      score,
      grade: gradeForScore(score),
    };
  };

  const impactA = impactFor(sideA.team, sendsA, sendsB);
  const impactB = impactFor(sideB.team, sendsB, sendsA);

  // Post-trade ranks compare against the partner's post-trade lineup.
  impactA.lineupRankAfter = rankAmong(
    impactA.lineupAfter,
    otherBaselines(sideA.team.id, sideB.team.id).concat(impactB.lineupAfter),
  );
  impactB.lineupRankAfter = rankAmong(
    impactB.lineupAfter,
    otherBaselines(sideB.team.id, sideA.team.id).concat(impactA.lineupAfter),
  );

  return {
    sides: [impactA, impactB],
    verdict: tradeVerdict(impactA, impactB),
  };
}

export function tradeVerdict(
  a: Pick<TradeTeamImpact, "team" | "score">,
  b: Pick<TradeTeamImpact, "team" | "score">,
): TradeVerdict {
  const gap = Math.abs(a.score - b.score);
  const winner = a.score >= b.score ? a.team : b.team;

  if (gap < 0.08) {
    return { kind: "fair", winnerTeamId: null, headline: "Fair trade" };
  }
  if (gap < 0.25) {
    return {
      kind: "edge",
      winnerTeamId: winner.id,
      headline: `Slight edge: ${winner.name}`,
    };
  }
  if (gap < 0.5) {
    return {
      kind: "win",
      winnerTeamId: winner.id,
      headline: `${winner.name} wins this trade`,
    };
  }
  return {
    kind: "lopsided",
    winnerTeamId: winner.id,
    headline: `Lopsided — ${winner.name} fleeces this one`,
  };
}
