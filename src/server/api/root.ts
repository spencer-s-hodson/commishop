import { leagueRouter } from "@/server/api/routers/league";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * Primary tRPC router. Product surface is league-scoped only.
 */
export const appRouter = createTRPCRouter({
  league: leagueRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
