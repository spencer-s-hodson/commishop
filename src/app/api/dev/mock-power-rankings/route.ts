import { NextResponse } from "next/server";

import { env } from "@/env";
import { seedMockPowerRankingWeeks } from "@/server/espn/power-ranking-mock-seed";

/**
 * Dev-only: invent Match 1–5 power ranking editions from the real preseason
 * roster + deterministic fake H2H results, then generate OpenAI blurbs.
 *
 * POST /api/dev/mock-power-rankings
 * Auth: Authorization: Bearer <CRON_SECRET> (or ?secret=)
 * Optional: ?weeks=1…5  &leagueId=<fantasyLeagueId>
 */
export async function POST(request: Request) {
  if (env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const authHeader = request.headers.get("authorization");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const provided = bearer ?? querySecret;

  if (!env.CRON_SECRET || provided !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weeksRaw = Number(url.searchParams.get("weeks") ?? "5");
  const weeks = Number.isFinite(weeksRaw)
    ? Math.min(5, Math.max(1, Math.trunc(weeksRaw)))
    : 5;
  const fantasyLeagueId = url.searchParams.get("leagueId") ?? undefined;

  try {
    const result = await seedMockPowerRankingWeeks({
      weeks,
      fantasyLeagueId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[dev mock-power-rankings]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Mock power rankings failed",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
