import { NextResponse } from "next/server";

import { env } from "@/env";
import {
  cronSecretFromRequest,
  isAuthorizedCronRequest,
} from "@/server/cron/authorize";
import { runPowerRankingPublishJob } from "@/server/espn/power-ranking-editions";

/**
 * Daily publish *check* (not a daily publish).
 *
 * Two UTC schedules in vercel.json so Utah local hour is always ~10:
 *   - `0 16 * * *` → 10am America/Denver during MDT
 *   - `0 17 * * *` → 10am America/Denver during MST
 * The off-season wake skips (Utah hour ≠ 10). Hobby may fire anytime within
 * that UTC hour.
 *
 * Publishes Match N only when ESPN Eastern calendar yesterday equals a
 * matchup period endDate.
 *
 * Auth: Authorization: Bearer <CRON_SECRET> (or ?secret= for local testing).
 * Manual: ?force=1 skips the Utah 10am hour gate.
 */
export async function GET(request: Request) {
  const provided = cronSecretFromRequest(request);

  if (!isAuthorizedCronRequest(provided, env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";

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
