/**
 * Fictional league data for the landing-page product demos. Team names and
 * managers are made up; NBA players are real but their numbers are not.
 */

import type { OverviewMatchupCardData } from "@/components/overview-dashboard";
import type { PowerRankingRow } from "@/components/power-rankings-dashboard";
import type {
  TradeLeagueContext,
  TradePlayer,
  TradePosition,
  TradeTeam,
} from "@/lib/trade-analysis";

export const DEMO_LEAGUE_NAME = "Pick & Roll League";

// ---------------------------------------------------------------------------
// Trade analyzer
// ---------------------------------------------------------------------------

const SLOT_BY_POSITION: Record<TradePosition, number[]> = {
  PG: [0, 5],
  SG: [1, 5],
  SF: [2, 6],
  PF: [3, 6],
  C: [4],
};

const GAMES_REMAINING = 62;
const REPLACEMENT_PPG = 23.5;

type PlayerSeed = [
  name: string,
  positions: TradePosition[],
  proTeam: string,
  ppg: number,
  injuryStatus?: string,
];

let nextPlayerId = 1;

function seedPlayer([
  name,
  positions,
  proTeam,
  ppg,
  injuryStatus,
]: PlayerSeed): TradePlayer {
  const availability =
    injuryStatus === "DAY_TO_DAY" ? 0.9 : injuryStatus === "OUT" ? 0.7 : 1;
  const eligibleSlots = [
    ...new Set(positions.flatMap((position) => SLOT_BY_POSITION[position])),
    11,
    12,
  ];
  return {
    id: nextPlayerId++,
    name,
    proTeam,
    positions,
    eligibleSlots,
    lineupSlotId: 12,
    injuryStatus: injuryStatus ?? null,
    ppg,
    projectedPpg: ppg,
    seasonPpg: ppg,
    seasonGamesPlayed: 20,
    recentPpg: ppg,
    availability,
    gamesRemaining: GAMES_REMAINING,
    restOfSeasonPoints: ppg * availability * GAMES_REMAINING,
    value: 0,
  };
}

function seedTeam(
  id: number,
  name: string,
  abbrev: string,
  ownerName: string,
  record: [number, number],
  players: PlayerSeed[],
  logoHue?: number,
): TradeTeam {
  return {
    id,
    name,
    abbrev,
    logoUrl: logoHue == null ? null : badge(abbrev, logoHue),
    ownerName,
    wins: record[0],
    losses: record[1],
    ties: 0,
    players: players.map(seedPlayer),
  };
}

const bucketBrigade = seedTeam(
  1,
  "Bucket Brigade",
  "BKT",
  "Maya Reyes",
  [4, 1],
  [
    ["Tyrese Haliburton", ["PG", "SG"], "IND", 48.8],
    ["Jayson Tatum", ["SF", "PF"], "BOS", 45.7],
    ["Jalen Duren", ["C"], "DET", 42.1],
    ["Julius Randle", ["PF"], "MIN", 38.8],
    ["De'Aaron Fox", ["PG", "SG"], "SA", 38.0, "DAY_TO_DAY"],
    ["Norman Powell", ["SG", "SF"], "MIA", 34.3],
    ["John Collins", ["PF", "C"], "UTA", 30.6],
    ["Mikal Bridges", ["SG", "SF"], "NY", 30.5],
    ["Ayo Dosunmu", ["PG", "SG"], "CHI", 29.8],
    ["Mitchell Robinson", ["C"], "NY", 29.0],
  ],
  24,
);

const glassCleaners = seedTeam(
  2,
  "Glass Cleaners",
  "GLS",
  "Theo Kim",
  [3, 2],
  [
    ["Anthony Davis", ["PF", "C"], "DAL", 50.6],
    ["Donovan Mitchell", ["PG", "SG"], "CLE", 46.5],
    ["LaMelo Ball", ["PG"], "CHA", 46.0],
    ["Jalen Williams", ["SF", "PF"], "OKC", 39.4],
    ["Damian Lillard", ["PG"], "POR", 39.8, "OUT"],
    ["Ivica Zubac", ["C"], "LAC", 35.6],
    ["Fred VanVleet", ["PG", "SG"], "HOU", 34.5],
    ["Naz Reid", ["PF", "C"], "MIN", 30.1],
    ["Aaron Gordon", ["PF"], "DEN", 28.9],
    ["Herbert Jones", ["SF"], "NOP", 27.8],
  ],
  200,
);

/** Background teams only feed lineup-rank math; the demo never shows them. */
const otherTeams: TradeTeam[] = [
  "Splash Mountain",
  "Dime Pieces",
  "Zone Defense",
  "Euro Steppers",
  "Rim Protectors",
  "Corner Three Club",
  "Fast Break Fiesta",
  "Board Man Gets Paid",
  "And-One Direction",
  "Pick & Pop Culture",
].map((name, teamIndex) =>
  seedTeam(
    teamIndex + 3,
    name,
    name.slice(0, 3).toUpperCase(),
    "Manager",
    [2, 3],
    (["PG", "SG", "SF", "PF", "C", "PG", "SF", "PF", "C", "SG"] as const).map(
      (position, slot): PlayerSeed => [
        `${name} ${slot + 1}`,
        [position],
        "FA",
        Math.round(
          (46 -
            teamIndex * 0.7 -
            slot * 2.1 -
            ((teamIndex * 7 + slot * 3) % 5)) *
            10,
        ) / 10,
      ],
    ),
  ),
);

const freeAgents = (
  [
    ["Keon Ellis", ["SG"], "SAC", 23.8],
    ["Isaiah Stewart", ["PF", "C"], "DET", 23.2],
    ["Tre Jones", ["PG"], "CHI", 22.6],
  ] satisfies PlayerSeed[]
).map(seedPlayer);

function assignTradeValues(teams: TradeTeam[]) {
  const overReplacement = (player: TradePlayer) =>
    Math.max(0, player.ppg * player.availability - REPLACEMENT_PPG) *
    player.gamesRemaining;
  const best = Math.max(
    ...teams.flatMap((team) => team.players.map(overReplacement)),
  );
  for (const team of teams) {
    for (const player of team.players) {
      player.value = 100 * (overReplacement(player) / best) ** 1.15;
    }
  }
}

export const tradeDemoTeams = [bucketBrigade, glassCleaners, ...otherTeams];
assignTradeValues(tradeDemoTeams);

export const tradeDemoContext: TradeLeagueContext = {
  starterSlots: [0, 1, 2, 3, 4, 5, 6, 11],
  activeRosterLimit: 10,
  freeAgents,
};

export const tradeDemoSides = { a: bucketBrigade, b: glassCleaners };

export function tradeDemoPlayerId(team: TradeTeam, name: string) {
  const player = team.players.find((candidate) => candidate.name === name);
  if (!player) throw new Error(`Unknown demo player: ${name}`);
  return player.id;
}

// ---------------------------------------------------------------------------
// League teams (shared by the overview and power-rankings demos)
// ---------------------------------------------------------------------------

type DemoTeam = {
  teamId: number;
  name: string;
  abbrev: string;
  ownerName: string;
  logoUrl: string;
};

/** Monogram badge so demo teams get a logo without hotlinking ESPN art. */
function badge(abbrev: string, hue: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="hsl(${hue} 62% 46%)"/><circle cx="20" cy="20" r="15" fill="none" stroke="white" stroke-opacity=".28" stroke-width="1.5"/><text x="20" y="25" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="white">${abbrev.slice(0, 2)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const leagueTeams = (
  [
    ["Bucket Brigade", "BKT", "Maya Reyes", 24],
    ["Glass Cleaners", "GLS", "Theo Kim", 200],
    ["Splash Mountain", "SPL", "Jordan Price", 188],
    ["Dime Pieces", "DIM", "Priya Shah", 282],
    ["Zone Defense", "ZON", "Marcus Bell", 140],
    ["Euro Steppers", "EUR", "Lena Ortiz", 330],
    ["Rim Protectors", "RIM", "Sam Whitaker", 4],
    ["Corner Three Club", "C3C", "Ava Chen", 165],
    ["Fast Break Fiesta", "FBF", "Diego Morales", 40],
    ["Board Man Gets Paid", "BMG", "Nia Brooks", 220],
    ["And-One Direction", "AOD", "Owen Park", 300],
    ["Pick & Pop Culture", "PPC", "Riley Quinn", 100],
  ] as const
).map(([name, abbrev, ownerName, hue], index): DemoTeam => ({
  teamId: index + 1,
  name,
  abbrev,
  ownerName,
  logoUrl: badge(abbrev, hue),
}));

function team(abbrev: string) {
  const found = leagueTeams.find((candidate) => candidate.abbrev === abbrev);
  if (!found) throw new Error(`Unknown demo team: ${abbrev}`);
  return found;
}

// ---------------------------------------------------------------------------
// Overview: matchups that play out as `progress` runs 0 → 1
// ---------------------------------------------------------------------------

type LiveSideSeed = {
  abbrev: string;
  /** Score at progress 0. */
  start: number;
  /** Final score at progress 1. */
  final: number;
  /** Projection at progress 0; drifts to `final` as games finish. */
  projected: number;
  games: number;
  left: number;
  players: number;
};

type LiveMatchupSeed = { home: LiveSideSeed; away: LiveSideSeed };

const side = (
  abbrev: string,
  start: number,
  final: number,
  projected: number,
  left = 18,
): LiveSideSeed => ({
  abbrev,
  start,
  final,
  projected,
  games: 28,
  left,
  players: 10,
});

export const overviewDemoSeeds: LiveMatchupSeed[] = [
  {
    home: side("BKT", 374, 952, 921),
    away: side("RIM", 352, 905, 896, 19),
  },
  // The comeback: GLS starts well behind and steals it late.
  {
    home: side("DIM", 401, 891, 948, 17),
    away: side("GLS", 318, 934, 861, 20),
  },
  {
    home: side("SPL", 284, 812, 783, 17),
    away: side("C3C", 345, 851, 899),
  },
  {
    home: side("ZON", 319, 897, 911, 19),
    away: side("FBF", 378, 884, 912),
  },
  {
    home: side("EUR", 380, 941, 929, 19),
    away: side("BMG", 338, 870, 908, 19),
  },
  {
    home: side("AOD", 338, 902, 959, 19),
    away: side("PPC", 334, 861, 848, 19),
  },
];

/** Index of the matchup the demo camera follows for the comeback. */
export const OVERVIEW_COMEBACK_INDEX = 1;

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** Normal-ish CDF via the logistic approximation. */
const winOdds = (margin: number, spread: number) =>
  1 / (1 + Math.exp((-1.7 * margin) / spread));

export function overviewMatchupAt(
  seed: LiveMatchupSeed,
  progress: number,
): OverviewMatchupCardData {
  const t = Math.min(1, Math.max(0, progress));
  const live = (input: LiveSideSeed) => {
    const left = Math.round(input.left * (1 - t));
    return {
      ...team(input.abbrev),
      score: Math.round(lerp(input.start, input.final, t)),
      projectedScore:
        Math.round(lerp(input.projected, input.final, t) * 10) / 10,
      gamesThisWeek: input.games,
      gamesRemaining: left,
      playersRemaining:
        left === 0 ? 0 : Math.max(1, Math.round(input.players * (1 - t * 0.7))),
    };
  };
  const home = live(seed.home);
  const away = live(seed.away);
  const spread = 70 * Math.sqrt(1 - t) + 2;
  const homeWinProbability =
    Math.round(
      winOdds(home.projectedScore - away.projectedScore, spread) * 1000,
    ) / 1000;

  return {
    matchupPeriodId: 6,
    home,
    away,
    homeWinProbability,
    awayWinProbability: Math.round((1 - homeWinProbability) * 1000) / 1000,
  };
}

// ---------------------------------------------------------------------------
// Power rankings: two locked editions so the demo can show movement
// ---------------------------------------------------------------------------

type RankingSeed = [
  abbrev: string,
  previousRank: number,
  record: [number, number],
  pointsFor: number,
  blurb: string,
];

function editionRows(rows: RankingSeed[]): PowerRankingRow[] {
  return rows.map(
    ([abbrev, previousRank, record, pointsFor, blurb], index) => ({
      ...team(abbrev),
      rank: index + 1,
      previousRank,
      wins: record[0],
      losses: record[1],
      ties: 0,
      pointsFor,
      blurb,
    }),
  );
}

export const powerRankingsDemoEditions = [
  {
    id: "match-4",
    label: "Match 4",
    publishedAt: "Nov 16, 2026",
    rankings: editionRows([
      [
        "BKT",
        1,
        [4, 0],
        2391.4,
        "**Bucket Brigade** stay perfect, and Tyrese Haliburton is running the league's best offense. A 61-point win over **Zone Defense** says this isn't a schedule mirage.",
      ],
      [
        "GLS",
        3,
        [3, 1],
        2402.8,
        "The league's top scorers finally got the wins to match. Anthony Davis is playing like a first-rounder again, and the only loss came by single digits to **Bucket Brigade**.",
      ],
      [
        "DIM",
        2,
        [3, 1],
        2317.5,
        "**Dime Pieces** slip a spot after scoring their lowest total of the season. The roster is still deep, but the guards went cold at the worst possible time.",
      ],
      [
        "ZON",
        6,
        [2, 2],
        2288.1,
        "Two straight wins and a jump of two spots. **Zone Defense** are winning with volume: no roster had more games played this week.",
      ],
      [
        "SPL",
        7,
        [2, 2],
        2264.0,
        "**Splash Mountain** quietly have the league's best bench. Once the starters get healthy, the rest of the league should be nervous.",
      ],
      [
        "EUR",
        4,
        [2, 2],
        2240.6,
        "A tough draw against **Glass Cleaners** cost **Euro Steppers** two spots. Their points-against total is the highest in the league.",
      ],
    ]),
  },
  {
    id: "match-5",
    label: "Match 5",
    publishedAt: "Nov 23, 2026",
    rankings: editionRows([
      [
        "GLS",
        2,
        [4, 1],
        3020.7,
        "**Glass Cleaners** take the top spot with a late comeback over **Dime Pieces**. They've scored the most points in the league, and now they lead in wins too.",
      ],
      [
        "BKT",
        1,
        [4, 1],
        2958.2,
        "The unbeaten run is over, but **Bucket Brigade** still posted a top-three score. A trade for more frontcourt depth would make them the favorite again.",
      ],
      [
        "SPL",
        5,
        [3, 2],
        2871.9,
        "The biggest climber this week. **Splash Mountain** won the league's highest-scoring matchup and now have the deepest roster in the top three.",
      ],
      [
        "DIM",
        3,
        [3, 2],
        2891.3,
        "A second straight loss, and this one stung after a 57-point lead on Wednesday. **Dime Pieces** still have the second-best points total.",
      ],
      [
        "ZON",
        4,
        [3, 2],
        2873.4,
        "**Zone Defense** keep winning through volume and depth. Next week's game against **Bucket Brigade** decides who leads the second tier.",
      ],
      [
        "EUR",
        6,
        [3, 2],
        2795.0,
        "Steady at six. **Euro Steppers** beat **Board Man Gets Paid** convincingly, but they need a ceiling week to break into the top five.",
      ],
    ]),
  },
] as const;
