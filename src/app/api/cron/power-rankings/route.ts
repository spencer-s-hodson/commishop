import { NextResponse } from "next/server";

import { env } from "@/env";
import { runPowerRankingPublishJob } from "@/server/espn/power-ranking-editions";

/**
 * Daily Vercel cron (Hobby: once/day). Runs ~16:00 UTC ≈ 10:00 America/Denver
 * (MDT) / 9:00 (MST). Publishes Match N when Denver yesterday equals a
 * matchup endDate.
 *
 * Auth: Authorization: Bearer <CRON_SECRET> (or ?secret= for local testing).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const bearer =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const provided = bearer ?? querySecret;

  if (!env.CRON_SECRET || provided !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = url.searchParams.get("force") === "1";

  try {
    const result = await runPowerRankingPublishJob({ force });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[power-rankings cron]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Power rankings cron failed",
      },
      { status: 500 },
    );
  }
}
