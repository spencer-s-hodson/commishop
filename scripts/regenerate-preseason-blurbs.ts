/**
 * One-off: regenerate preseason blurbs against the DB in DATABASE_URL.
 *
 *   DATABASE_URL=... OPENAI_API_KEY=... npx tsx scripts/regenerate-preseason-blurbs.ts
 */
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { powerRankingEdition } from "@/server/db/schema";
import { ensureEditionBlurbs } from "@/server/espn/power-ranking-editions";

async function main() {
  const editions = await db.query.powerRankingEdition.findMany({
    where: eq(powerRankingEdition.kind, "preseason"),
    with: { fantasyLeague: true },
  });

  if (editions.length === 0) {
    console.log("No preseason editions found.");
    return;
  }

  for (const edition of editions) {
    const leagueName = edition.fantasyLeague?.name ?? edition.fantasyLeagueId;
    console.log(
      `Regenerating blurbs for ${leagueName} / ${edition.label} (${edition.id})…`,
    );
    await ensureEditionBlurbs(edition.id, { force: true });
    console.log(`Done: ${edition.id}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
