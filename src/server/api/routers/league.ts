import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  emptyToNull,
  privateLeagueCredentialsError,
} from "@/server/api/league-connect";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { fantasyLeague } from "@/server/db/schema";
import {
  fetchEspnLeagueOverview,
  fetchEspnLeagueSummary,
} from "@/server/espn/overview";
import { toDisplayLogoUrl } from "@/server/espn/logo-url";
import {
  ensureEditionBlurbs,
  ensurePreseasonEdition,
  getLatestPowerRankingEdition,
  getPowerRankingEditionById,
  listPowerRankingEditions,
} from "@/server/espn/power-ranking-editions";

const connectInput = z.object({
  espnLeagueId: z.coerce.number().int().positive(),
  seasonYear: z.coerce.number().int().min(2000).max(2100),
  espnS2: z.string().trim().optional(),
  swid: z.string().trim().optional(),
});

export const leagueRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const leagues = await ctx.db.query.fantasyLeague.findMany({
      where: eq(fantasyLeague.userId, ctx.session.user.id),
      orderBy: (league, { desc }) => [desc(league.updatedAt)],
      columns: {
        id: true,
        espnLeagueId: true,
        seasonYear: true,
        name: true,
        isPrivate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return leagues;
  }),

  connect: protectedProcedure
    .input(connectInput)
    .mutation(async ({ ctx, input }) => {
      const espnS2 = emptyToNull(input.espnS2);
      const swid = emptyToNull(input.swid);

      const credentialsError = privateLeagueCredentialsError(espnS2, swid);
      if (credentialsError) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: credentialsError,
        });
      }

      let summary;
      try {
        summary = await fetchEspnLeagueSummary(
          input.espnLeagueId,
          input.seasonYear,
          { espnS2, swid },
        );
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Failed to connect to ESPN league.",
        });
      }

      const existing = await ctx.db.query.fantasyLeague.findFirst({
        where: and(
          eq(fantasyLeague.userId, ctx.session.user.id),
          eq(fantasyLeague.espnLeagueId, input.espnLeagueId),
          eq(fantasyLeague.seasonYear, input.seasonYear),
        ),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(fantasyLeague)
          .set({
            name: summary.name,
            isPrivate: summary.isPrivate,
            espnS2,
            swid,
          })
          .where(eq(fantasyLeague.id, existing.id))
          .returning({
            id: fantasyLeague.id,
            espnLeagueId: fantasyLeague.espnLeagueId,
            seasonYear: fantasyLeague.seasonYear,
            name: fantasyLeague.name,
            isPrivate: fantasyLeague.isPrivate,
          });

        return updated!;
      }

      const [created] = await ctx.db
        .insert(fantasyLeague)
        .values({
          id: crypto.randomUUID(),
          userId: ctx.session.user.id,
          espnLeagueId: input.espnLeagueId,
          seasonYear: input.seasonYear,
          name: summary.name,
          isPrivate: summary.isPrivate,
          espnS2,
          swid,
        })
        .returning({
          id: fantasyLeague.id,
          espnLeagueId: fantasyLeague.espnLeagueId,
          seasonYear: fantasyLeague.seasonYear,
          name: fantasyLeague.name,
          isPrivate: fantasyLeague.isPrivate,
        });

      return created!;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.fantasyLeague.findFirst({
        where: and(
          eq(fantasyLeague.id, input.id),
          eq(fantasyLeague.userId, ctx.session.user.id),
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "League not found.",
        });
      }

      await ctx.db
        .delete(fantasyLeague)
        .where(eq(fantasyLeague.id, existing.id));

      return { ok: true as const };
    }),

  overview: protectedProcedure
    .input(
      z.object({
        leagueId: z.string().min(1),
        matchupPeriodId: z.coerce.number().int().positive().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const league = await ctx.db.query.fantasyLeague.findFirst({
        where: and(
          eq(fantasyLeague.id, input.leagueId),
          eq(fantasyLeague.userId, ctx.session.user.id),
        ),
      });

      if (!league) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "League not found.",
        });
      }

      try {
        const overview = await fetchEspnLeagueOverview(
          league.espnLeagueId,
          league.seasonYear,
          { espnS2: league.espnS2, swid: league.swid },
          { matchupPeriodId: input.matchupPeriodId },
        );

        return {
          connectedLeagueId: league.id,
          ...overview,
          logoUrl: toDisplayLogoUrl(overview.logoUrl, league.id),
          standings: overview.standings.map((team) => ({
            ...team,
            logoUrl: toDisplayLogoUrl(team.logoUrl, league.id),
          })),
          matchups: overview.matchups.map((matchup) => ({
            ...matchup,
            home: {
              ...matchup.home,
              logoUrl: toDisplayLogoUrl(matchup.home.logoUrl, league.id),
            },
            away: matchup.away
              ? {
                  ...matchup.away,
                  logoUrl: toDisplayLogoUrl(matchup.away.logoUrl, league.id),
                }
              : null,
          })),
        };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load ESPN league overview.",
        });
      }
    }),

  powerRankings: createTRPCRouter({
    editions: protectedProcedure
      .input(z.object({ leagueId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const league = await ctx.db.query.fantasyLeague.findFirst({
          where: and(
            eq(fantasyLeague.id, input.leagueId),
            eq(fantasyLeague.userId, ctx.session.user.id),
          ),
        });

        if (!league) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "League not found.",
          });
        }

        try {
          await ensurePreseasonEdition(league);
          const editions = await listPowerRankingEditions(league.id);
          const latest = editions.at(-1) ?? null;

          return {
            connectedLeagueId: league.id,
            leagueName: league.name,
            editions: editions.map((edition) => ({
              id: edition.id,
              kind: edition.kind,
              matchupPeriodId: edition.matchupPeriodId,
              label: edition.label,
              throughMatchupPeriod: edition.throughMatchupPeriod,
              publishedAt: edition.publishedAt,
            })),
            latestEditionId: latest?.id ?? null,
          };
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load power ranking editions.",
          });
        }
      }),

    byEdition: protectedProcedure
      .input(
        z.object({
          leagueId: z.string().min(1),
          editionId: z.string().min(1).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const league = await ctx.db.query.fantasyLeague.findFirst({
          where: and(
            eq(fantasyLeague.id, input.leagueId),
            eq(fantasyLeague.userId, ctx.session.user.id),
          ),
        });

        if (!league) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "League not found.",
          });
        }

        try {
          await ensurePreseasonEdition(league);

          const editionId =
            input.editionId ??
            (await getLatestPowerRankingEdition(league.id))?.id;

          if (!editionId) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "No power ranking editions published yet.",
            });
          }

          await ensureEditionBlurbs(editionId);

          const edition = await getPowerRankingEditionById(
            league.id,
            editionId,
          );

          if (!edition) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Power ranking edition not found.",
            });
          }

          return {
            connectedLeagueId: league.id,
            leagueName: league.name,
            edition: {
              id: edition.id,
              kind: edition.kind,
              matchupPeriodId: edition.matchupPeriodId,
              label: edition.label,
              throughMatchupPeriod: edition.throughMatchupPeriod,
              publishedAt: edition.publishedAt,
            },
            rankings: edition.entries.map((entry) => ({
              teamId: entry.teamId,
              name: entry.name,
              abbrev: entry.abbrev,
              logoUrl: toDisplayLogoUrl(entry.logoUrl, league.id),
              ownerName: entry.ownerName,
              wins: entry.wins,
              losses: entry.losses,
              ties: entry.ties,
              pointsFor: entry.pointsFor,
              pointsAgainst: entry.pointsAgainst,
              rank: entry.rank,
              previousRank: entry.previousRank,
              powerScore: entry.powerScore,
              dominance: entry.dominance,
              avgScore: entry.avgScore,
              avgMov: entry.avgMov,
              blurb: entry.blurb,
            })),
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load power ranking edition.",
          });
        }
      }),
  }),
});
