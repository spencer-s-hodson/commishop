import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  pgTableCreator,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `pg-drizzle_${name}`);

export const posts = createTable(
  "post",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdById: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => user.id),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("created_by_idx").on(t.createdById),
    index("name_idx").on(t.name),
  ]
);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
});

export const fantasyLeague = pgTable(
  "fantasy_league",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    espnLeagueId: integer("espn_league_id").notNull(),
    seasonYear: integer("season_year").notNull(),
    name: text("name").notNull(),
    isPrivate: boolean("is_private").notNull().default(false),
    espnS2: text("espn_s2"),
    swid: text("swid"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("fantasy_league_user_idx").on(t.userId),
    uniqueIndex("fantasy_league_user_espn_season_uidx").on(
      t.userId,
      t.espnLeagueId,
      t.seasonYear,
    ),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  account: many(account),
  session: many(session),
  fantasyLeagues: many(fantasyLeague),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

/** Locked power ranking snapshot (Preseason or Match N). */
export const powerRankingEdition = pgTable(
  "power_ranking_edition",
  {
    id: text("id").primaryKey(),
    fantasyLeagueId: text("fantasy_league_id")
      .notNull()
      .references(() => fantasyLeague.id, { onDelete: "cascade" }),
    seasonYear: integer("season_year").notNull(),
    /** `preseason` | `match` */
    kind: text("kind").notNull(),
    /**
     * 0 for preseason; 1…N for match editions.
     * Stored as 0 (not null) so the unique index is reliable in Postgres.
     */
    matchupPeriodId: integer("matchup_period_id").notNull().default(0),
    label: text("label").notNull(),
    /** 0 for preseason; N for Match N. */
    throughMatchupPeriod: integer("through_matchup_period").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    index("power_ranking_edition_league_idx").on(t.fantasyLeagueId),
    uniqueIndex("power_ranking_edition_league_kind_match_uidx").on(
      t.fantasyLeagueId,
      t.kind,
      t.matchupPeriodId,
    ),
  ],
);

export const powerRankingEntry = pgTable(
  "power_ranking_entry",
  {
    id: text("id").primaryKey(),
    editionId: text("edition_id")
      .notNull()
      .references(() => powerRankingEdition.id, { onDelete: "cascade" }),
    teamId: integer("team_id").notNull(),
    rank: integer("rank").notNull(),
    previousRank: integer("previous_rank"),
    powerScore: doublePrecision("power_score").notNull(),
    dominance: doublePrecision("dominance").notNull().default(0),
    avgScore: doublePrecision("avg_score").notNull().default(0),
    avgMov: doublePrecision("avg_mov").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    ties: integer("ties").notNull().default(0),
    pointsFor: doublePrecision("points_for").notNull().default(0),
    pointsAgainst: doublePrecision("points_against").notNull().default(0),
    name: text("name").notNull(),
    abbrev: text("abbrev").notNull(),
    logoUrl: text("logo_url"),
    ownerName: text("owner_name"),
    /** Friendly 4–5 sentence write-up generated at publish time. */
    blurb: text("blurb"),
  },
  (t) => [
    index("power_ranking_entry_edition_idx").on(t.editionId),
    uniqueIndex("power_ranking_entry_edition_team_uidx").on(
      t.editionId,
      t.teamId,
    ),
  ],
);

export const fantasyLeagueRelations = relations(fantasyLeague, ({ one, many }) => ({
  user: one(user, {
    fields: [fantasyLeague.userId],
    references: [user.id],
  }),
  powerRankingEditions: many(powerRankingEdition),
}));

export const powerRankingEditionRelations = relations(
  powerRankingEdition,
  ({ one, many }) => ({
    fantasyLeague: one(fantasyLeague, {
      fields: [powerRankingEdition.fantasyLeagueId],
      references: [fantasyLeague.id],
    }),
    entries: many(powerRankingEntry),
  }),
);

export const powerRankingEntryRelations = relations(
  powerRankingEntry,
  ({ one }) => ({
    edition: one(powerRankingEdition, {
      fields: [powerRankingEntry.editionId],
      references: [powerRankingEdition.id],
    }),
  }),
);
