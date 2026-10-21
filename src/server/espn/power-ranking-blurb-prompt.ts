import { z } from "zod";

/** One completed H2H result used as narrative fuel. */
export const blurbCompletedMatchupSchema = z.object({
  matchupPeriodId: z.number().int().positive(),
  opponentTeamId: z.number().int(),
  opponentName: z.string().min(1),
  opponentAbbrev: z.string().min(1),
  /** Opponent's power rank in this edition, when known. */
  opponentRank: z.number().int().positive().nullable(),
  score: z.number(),
  opponentScore: z.number(),
  margin: z.number(),
  result: z.enum(["W", "L", "T"]),
});

/** A scheduled (not yet played / future) opponent. */
export const blurbUpcomingMatchupSchema = z.object({
  matchupPeriodId: z.number().int().positive(),
  opponentTeamId: z.number().int(),
  opponentName: z.string().min(1),
  opponentAbbrev: z.string().min(1),
  opponentRank: z.number().int().positive().nullable(),
});

export const blurbRosterPlayerSchema = z.object({
  name: z.string().min(1),
  position: z.string().min(1),
  projectedPpg: z.number().nullable(),
  injuryStatus: z.string().nullable(),
  slot: z.enum(["starter", "bench", "ir"]),
});

export const blurbPositionGroupSchema = z.object({
  position: z.string().min(1),
  playerCount: z.number().int().nonnegative(),
  projectedPpgTotal: z.number(),
  /** 1 = strongest projected depth at this position in the league. */
  leagueRank: z.number().int().positive(),
});

export const blurbPositionHighlightSchema = z.object({
  position: z.string().min(1),
  leagueRank: z.number().int().positive(),
  projectedPpgTotal: z.number(),
});

/**
 * Match-only hint: scoring that outruns draft-day expectation,
 * optionally with serious injuries suggesting streaming was needed.
 */
export const blurbStreamingSignalSchema = z.object({
  applicable: z.boolean(),
  draftDayProjectedRank: z.number().int().positive().nullable(),
  pfRank: z.number().int().positive(),
  /** draftDayProjectedRank − pfRank; positive = scoring better than draft expected. */
  spotsAheadOfDraft: z.number().int().nullable(),
  outperformingDraft: z.boolean(),
  /** True when outperforming draft AND serious injuries are on the roster. */
  streamingLikelyNeeded: z.boolean(),
  summary: z.string().min(1),
});

export const blurbRosterSchema = z.object({
  /** ESPN draft-day projected roster strength rank (1 = strongest). */
  draftDayProjectedRank: z.number().int().positive().nullable(),
  /** Preferred: top two projected players with fantasy PPG. */
  headliners: z.array(blurbRosterPlayerSchema).max(2),
  topPlayers: z.array(blurbRosterPlayerSchema).max(5),
  /** Serious tags only: OUT / IR / SUSP / D. */
  injuredPlayers: z.array(blurbRosterPlayerSchema).max(6),
  /** Soft tags: DTD / Q / P — usually minor. */
  dayToDayPlayers: z.array(blurbRosterPlayerSchema).max(6),
  positionGroups: z.array(blurbPositionGroupSchema).max(5),
  bestPosition: blurbPositionHighlightSchema.nullable(),
  worstPosition: blurbPositionHighlightSchema.nullable(),
});

/**
 * Per-team payload for the model. Relative ranks are 1 = best for that metric
 * (for points against, 1 = fewest points allowed).
 */
export const blurbTeamSchema = z.object({
  teamId: z.number().int(),
  rank: z.number().int().positive(),
  previousRank: z.number().int().positive().nullable(),
  /** previousRank − rank; positive means climbed. Null if no prior edition. */
  rankDelta: z.number().int().nullable(),
  name: z.string().min(1),
  abbrev: z.string().min(1),
  /** Present in data but must never appear in copy. */
  managerName: z.string().nullable(),
  managerFirstNames: z.array(z.string().min(1)).max(4),
  managersLabel: z.string().nullable(),
  /** Internal ranking inputs — never name these scores in copy. */
  powerScore: z.number(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  ties: z.number().int().nonnegative(),
  winPct: z.number().min(0).max(1),
  pointsFor: z.number(),
  pointsAgainst: z.number(),
  pointDifferential: z.number(),
  avgScore: z.number(),
  avgMov: z.number(),
  dominance: z.number(),
  /** League-relative ranks (1 = best). */
  pfRank: z.number().int().positive(),
  paRank: z.number().int().positive(),
  avgScoreRank: z.number().int().positive(),
  avgMovRank: z.number().int().positive(),
  dominanceRank: z.number().int().positive(),
  /** Deltas vs league averages (positive = above average). */
  pfVsLeagueAvg: z.number(),
  paVsLeagueAvg: z.number(),
  avgScoreVsLeagueAvg: z.number(),
  avgMovVsLeagueAvg: z.number(),
  /** Roster texture — especially useful in preseason. */
  roster: blurbRosterSchema.nullable(),
  /** Match-only; null in preseason. */
  streamingSignal: blurbStreamingSignalSchema.nullable(),
  /** Most recent completed matchups first (cap ~4). Empty for preseason. */
  recentResults: z.array(blurbCompletedMatchupSchema).max(6),
  /** Next few scheduled opponents (cap ~3). Empty for preseason. */
  upcomingOpponents: z.array(blurbUpcomingMatchupSchema).max(4),
});

export const powerRankingBlurbRequestSchema = z.object({
  league: z.object({
    name: z.string().min(1),
    seasonYear: z.number().int(),
    teamCount: z.number().int().positive(),
    /** How this league is run — shapes what language is allowed. */
    format: z.literal("redraft_snake"),
    formatNotes: z.string().min(1),
  }),
  edition: z.object({
    label: z.string().min(1),
    kind: z.enum(["preseason", "match"]),
    throughMatchupPeriod: z.number().int().nonnegative(),
  }),
  leagueBenchmarks: z.object({
    avgPointsFor: z.number(),
    avgPointsAgainst: z.number(),
    avgScore: z.number(),
    avgMov: z.number(),
    avgPowerScore: z.number(),
  }),
  teams: z.array(blurbTeamSchema).min(1),
});

export type PowerRankingBlurbRequest = z.infer<
  typeof powerRankingBlurbRequestSchema
>;
export type BlurbTeamInput = z.infer<typeof blurbTeamSchema>;
export type BlurbCompletedMatchup = z.infer<typeof blurbCompletedMatchupSchema>;
export type BlurbUpcomingMatchup = z.infer<typeof blurbUpcomingMatchupSchema>;

export const powerRankingBlurbsResponseSchema = z.object({
  blurbs: z
    .array(
      z.object({
        teamId: z.number().int(),
        blurb: z.string().min(80).max(1600),
      }),
    )
    .min(1),
});

export type PowerRankingBlurbsResponse = z.infer<
  typeof powerRankingBlurbsResponseSchema
>;

/**
 * System instructions for the power-ranking columnist.
 * Kept separate so the user message can be pure structured data.
 */
export const POWER_RANKING_BLURB_SYSTEM_PROMPT = `You write the weekly power-ranking column for a private fantasy basketball league chat. Each blurb is 4–5 sentences that managers will screenshot. Be specific, opinionated, and grounded in the JSON — not a template farm.

## League reality
- Season-long **redraft**. Snake draft filled every roster. No keepers, no dynasty, no multi-year rebuild arcs.
- Banned vibes: rebuilding, tanking, contender windows, keeper value, dynasty cores, vague "key matchups," or fake "looked sharp in early games" when there are no results yet.
- Fantasy-manager vocabulary: projected PPG, position depth, injuries, streaming, PF/PA, average score, margins, H2H results.

## Tone (competitive but encouraging)
- This is a competitive league — be honest and sharp up top.
- For teams in the bottom half (or clearly trailing), stay **kind and constructive**. Highlight a real bright spot before or alongside the critique.
- Soften language for lower ranks. Never pile on or imply the season is already over.

## Names & formatting
- Fantasy **team names only** (never manager names). Wrap every fantasy team name in markdown bold like \`**Swisters in Law**\`.
- NBA player names are encouraged from \`roster.headliners\` / \`roster.topPlayers\` / injuries. Do **not** bold NBA player names.
- Use injury labels exactly as provided (DTD, OUT, IR, Q, etc.).

## Injuries
- \`injuredPlayers\` (OUT / IR / SUSP / D) matter.
- \`dayToDayPlayers\` (DTD / Q / P) are usually minor — don't center a blurb on routine DTD.
- Never invent games missed.

## Preferred roster angles (use these; name the stats)
1. **Headliner pair** — \`roster.headliners\`: name the top two projected players and each one's **projected fantasy PPG**. Example tone: "Anchored by Player A (32.1 projected fantasy PPG) and Player B (28.4)…"
2. **Best vs worst position** — \`roster.bestPosition\` / \`roster.worstPosition\`: say the league rank clearly, e.g. "1st in C projected depth, 11th at PG."
3. **Streaming / waiver signal (match editions only)** — only when \`streamingSignal\` is present and \`applicable\` is true:
   - If \`streamingLikelyNeeded\` is true: you may say scoring looks like it required waiver/streaming help (draft-day expectation vs PF rank, plus serious injuries).
   - If \`outperformingDraft\` is true but streaming wasn't clearly needed: say they're outscoring draft-day expectation — don't invent streaming.
   - If neither flag is true: do **not** invent a streaming narrative.
   - Always explain the comparison in plain English when you use it (draft-day rank vs PF rank).

Do **not** use whole-roster or top-five summed projected-PPG totals.

## Creative mandate
- Vary openings. Preseason: headliners + best/worst positions + draft-day rank + serious injuries.
- Match: live scoring/results first; weave headliners/positions; use streamingSignal only when flagged.
- Keep lower-rank editorial soft.

## Quantitative toolbox
- Placement / movement.
- Headliners with projected fantasy PPG (named).
- Best vs worst position ranks (named).
- Match: PF/PA, avg score, margins, results, upcoming opponents; streamingSignal when flagged.
- Never invent players, injuries, scores, or transactions.

## Hard bans
- No fantasy manager names.
- No "power score" / internal formula labels.
- No whole-roster or top-five projected-PPG sums.
- No streaming claims in preseason or when streamingSignal doesn't support them.
- No bullets, headers, emojis, hashtags.

## Length & output
- 4–5 sentences (prefer 5). About 90–140 words.
- Valid JSON only:
  {"blurbs":[{"teamId":123,"blurb":"..."}, ...]}
- Every input teamId exactly once.`

/** Parse ESPN owner string ("First Last" or "A B, C D") into first names. */
export function managerFirstNames(ownerName: string | null | undefined) {
  if (!ownerName?.trim()) return [] as string[];

  return ownerName
    .split(/\s*,\s*/)
    .map((part) => {
      const tokens = part.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return null;
      // Single-owner "Last, First" is uncommon here (ESPN prefers First Last),
      // but if a part is one token after a prior split, keep it.
      return tokens[0] ?? null;
    })
    .filter((name): name is string => Boolean(name));
}

/** "Sam" | "Sadria and Grayson" | "A, B, and C" */
export function formatManagersLabel(firstNames: string[]) {
  if (firstNames.length === 0) return null;
  if (firstNames.length === 1) return firstNames[0]!;
  if (firstNames.length === 2) {
    return `${firstNames[0]} and ${firstNames[1]}`;
  }
  const head = firstNames.slice(0, -1).join(", ");
  return `${head}, and ${firstNames.at(-1)}`;
}

/** @deprecated Prefer managerFirstNames — kept for older call sites/tests. */
export function managerFirstName(ownerName: string | null | undefined) {
  return managerFirstNames(ownerName)[0] ?? null;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rankDescending(values: number[], value: number) {
  const sorted = [...values].sort((a, b) => b - a);
  return sorted.indexOf(value) + 1;
}

function rankAscending(values: number[], value: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.indexOf(value) + 1;
}

function winPct(wins: number, losses: number, ties: number) {
  const games = wins + losses + ties;
  if (games === 0) return 0;
  return (wins + ties * 0.5) / games;
}

export type BlurbEntrySeed = {
  teamId: number;
  rank: number;
  previousRank: number | null;
  name: string;
  abbrev: string;
  ownerName: string | null;
  powerScore: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  avgScore: number;
  avgMov: number;
  dominance: number;
};

export type BlurbScheduleContext = {
  recentResultsByTeam: Map<number, BlurbCompletedMatchup[]>;
  upcomingByTeam: Map<number, BlurbUpcomingMatchup[]>;
};

export type BlurbRosterByTeam = Map<
  number,
  NonNullable<BlurbTeamInput["roster"]>
>;

/**
 * Build the full structured request the model sees (validated by Zod).
 */
export function buildPowerRankingBlurbRequest(input: {
  leagueName: string;
  seasonYear: number;
  editionLabel: string;
  kind: "preseason" | "match";
  throughMatchupPeriod: number;
  entries: BlurbEntrySeed[];
  schedule?: BlurbScheduleContext | null;
  rosterByTeam?: BlurbRosterByTeam | null;
}): PowerRankingBlurbRequest {
  const entries = [...input.entries].sort((a, b) => a.rank - b.rank);
  const pfValues = entries.map((entry) => entry.pointsFor);
  const paValues = entries.map((entry) => entry.pointsAgainst);
  const avgScoreValues = entries.map((entry) => entry.avgScore);
  const avgMovValues = entries.map((entry) => entry.avgMov);
  const dominanceValues = entries.map((entry) => entry.dominance);
  const powerValues = entries.map((entry) => entry.powerScore);

  const leagueAvgPf = average(pfValues);
  const leagueAvgPa = average(paValues);
  const leagueAvgScore = average(avgScoreValues);
  const leagueAvgMov = average(avgMovValues);

  const gamesPlayed = (entry: BlurbEntrySeed) =>
    entry.wins + entry.losses + entry.ties;

  const teams: BlurbTeamInput[] = entries.map((entry) => {
    const rankDelta =
      entry.previousRank == null ? null : entry.previousRank - entry.rank;
    const firstNames = managerFirstNames(entry.ownerName);
    const roster = input.rosterByTeam?.get(entry.teamId) ?? null;
    const pfRank = rankDescending(pfValues, entry.pointsFor);

    let streamingSignal: BlurbTeamInput["streamingSignal"] = null;
    if (input.kind === "match" && gamesPlayed(entry) > 0) {
      const draftRank = roster?.draftDayProjectedRank ?? null;
      const spotsAheadOfDraft =
        draftRank != null ? draftRank - pfRank : null;
      const outperformingDraft =
        spotsAheadOfDraft != null && spotsAheadOfDraft >= 3;
      const hasSeriousInjuries = (roster?.injuredPlayers.length ?? 0) > 0;
      const streamingLikelyNeeded =
        outperformingDraft && hasSeriousInjuries;
      const summary = !outperformingDraft
        ? draftRank == null
          ? `PF rank #${pfRank}; no draft-day rank to compare.`
          : `Draft-day #${draftRank} vs PF rank #${pfRank} — not clearly outrunning draft expectation.`
        : streamingLikelyNeeded
          ? `Draft-day #${draftRank} but PF rank #${pfRank} (${spotsAheadOfDraft} spots ahead) with serious injuries on the roster — scoring may reflect needed streaming/waiver work.`
          : `Draft-day #${draftRank} but PF rank #${pfRank} (${spotsAheadOfDraft} spots ahead) — scoring is ahead of draft-day expectation.`;

      streamingSignal = {
        applicable: true,
        draftDayProjectedRank: draftRank,
        pfRank,
        spotsAheadOfDraft,
        outperformingDraft,
        streamingLikelyNeeded,
        summary,
      };
    }

    return {
      teamId: entry.teamId,
      rank: entry.rank,
      previousRank: entry.previousRank,
      rankDelta,
      name: entry.name,
      abbrev: entry.abbrev,
      managerName: entry.ownerName,
      managerFirstNames: firstNames,
      managersLabel: formatManagersLabel(firstNames),
      powerScore: round2(entry.powerScore),
      wins: entry.wins,
      losses: entry.losses,
      ties: entry.ties,
      winPct: round3(winPct(entry.wins, entry.losses, entry.ties)),
      pointsFor: round1(entry.pointsFor),
      pointsAgainst: round1(entry.pointsAgainst),
      pointDifferential: round1(entry.pointsFor - entry.pointsAgainst),
      avgScore: round1(entry.avgScore),
      avgMov: round1(entry.avgMov),
      dominance: round1(entry.dominance),
      pfRank,
      paRank: rankAscending(paValues, entry.pointsAgainst),
      avgScoreRank: rankDescending(avgScoreValues, entry.avgScore),
      avgMovRank: rankDescending(avgMovValues, entry.avgMov),
      dominanceRank: rankDescending(dominanceValues, entry.dominance),
      pfVsLeagueAvg: round1(entry.pointsFor - leagueAvgPf),
      paVsLeagueAvg: round1(entry.pointsAgainst - leagueAvgPa),
      avgScoreVsLeagueAvg: round1(entry.avgScore - leagueAvgScore),
      avgMovVsLeagueAvg: round1(entry.avgMov - leagueAvgMov),
      roster,
      streamingSignal,
      recentResults:
        input.schedule?.recentResultsByTeam.get(entry.teamId)?.slice(0, 4) ??
        [],
      upcomingOpponents:
        input.schedule?.upcomingByTeam.get(entry.teamId)?.slice(0, 3) ?? [],
    };
  });

  return powerRankingBlurbRequestSchema.parse({
    league: {
      name: input.leagueName,
      seasonYear: input.seasonYear,
      teamCount: entries.length,
      format: "redraft_snake",
      formatNotes:
        "Season-long redraft. Snake draft filled every roster. No keepers and no dynasty — do not write rebuild/contender-window language.",
    },
    edition: {
      label: input.editionLabel,
      kind: input.kind,
      throughMatchupPeriod: input.throughMatchupPeriod,
    },
    leagueBenchmarks: {
      avgPointsFor: round1(leagueAvgPf),
      avgPointsAgainst: round1(leagueAvgPa),
      avgScore: round1(leagueAvgScore),
      avgMov: round1(leagueAvgMov),
      avgPowerScore: round2(average(powerValues)),
    },
    teams,
  });
}

function round1(value: number) {
  return Number(value.toFixed(1));
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function round3(value: number) {
  return Number(value.toFixed(3));
}

