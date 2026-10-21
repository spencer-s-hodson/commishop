import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { getSession } from "@/server/better-auth/server";
import { db } from "@/server/db";
import { fantasyLeague } from "@/server/db/schema";
import { isEspnCustomLogoUrl } from "@/server/espn/logo";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const leagueId = request.nextUrl.searchParams.get("leagueId")?.trim();
  const src = request.nextUrl.searchParams.get("src")?.trim();

  if (!leagueId || !src || !isEspnCustomLogoUrl(src)) {
    return new Response("Invalid logo request", { status: 400 });
  }

  const league = await db.query.fantasyLeague.findFirst({
    where: and(
      eq(fantasyLeague.id, leagueId),
      eq(fantasyLeague.userId, session.user.id),
    ),
    columns: {
      espnS2: true,
      swid: true,
    },
  });

  if (!league?.espnS2 || !league.swid) {
    return new Response("Missing ESPN credentials for this league", {
      status: 403,
    });
  }

  const upstream = await fetch(src, {
    headers: {
      Accept: "image/*,*/*",
      Cookie: `espn_s2=${league.espnS2}; SWID=${league.swid}`,
    },
    cache: "force-cache",
  });

  if (!upstream.ok) {
    return new Response("Failed to load ESPN logo", { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  const body = await upstream.arrayBuffer();

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
