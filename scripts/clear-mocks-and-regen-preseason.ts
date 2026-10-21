/**
 * Delete local mock power-ranking editions, then regenerate preseason blurbs.
 *
 *   npx tsx --import ./scripts/stub-server-only-loader.mjs scripts/clear-mocks-and-regen-preseason.ts
 */
import { eq, gte } from "drizzle-orm";

import { db } from "@/server/db";
import {
  powerRankingEdition,
  powerRankingEntry,
} from "@/server/db/schema";
import { ensureEditionBlurbs } from "@/server/espn/power-ranking-editions";
import { MOCK_MATCHUP_PERIOD_BASE } from "@/server/espn/power-ranking-mock";

async function main() {
  const mocks = await db.query.powerRankingEdition.findMany({
    where: gte(powerRankingEdition.matchupPeriodId, MOCK_MATCHUP_PERIOD_BASE),
  });
  console.log(`Found ${mocks.length} mock edition(s) to delete.`);
  for (const edition of mocks) {
    await db
      .delete(powerRankingEntry)
      .where(eq(powerRankingEntry.editionId, edition.id));
    await db
      .delete(powerRankingEdition)
      .where(eq(powerRankingEdition.id, edition.id));
    console.log(`Deleted mock: ${edition.label} (${edition.id})`);
  }

  const preseason = await db.query.powerRankingEdition.findMany({
    where: eq(powerRankingEdition.kind, "preseason"),
    with: { fantasyLeague: true },
  });
  for (const edition of preseason) {
    const leagueName = edition.fantasyLeague?.name ?? edition.fantasyLeagueId;
    console.log(
      `Regenerating preseason blurbs for ${leagueName} (${edition.id})…`,
    );
    await ensureEditionBlurbs(edition.id, { force: true });
    console.log(`Done: ${edition.id}`);
  }

  const remainingMocks = await db.query.powerRankingEdition.findMany({
    where: gte(powerRankingEdition.matchupPeriodId, MOCK_MATCHUP_PERIOD_BASE),
  });
  console.log(`Remaining mock editions: ${remainingMocks.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
