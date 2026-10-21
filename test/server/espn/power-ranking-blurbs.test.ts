import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPowerRankingBlurbRequest,
  formatManagersLabel,
  managerFirstNames,
  powerRankingBlurbRequestSchema,
} from "@/server/espn/power-ranking-blurb-prompt";

describe("managerFirstNames", () => {
  it("parses single and co-manager owner strings", () => {
    assert.deepEqual(managerFirstNames("Alex Rivera"), ["Alex"]);
    assert.deepEqual(managerFirstNames("Sadria Smith, Grayson Jones"), [
      "Sadria",
      "Grayson",
    ]);
    assert.deepEqual(managerFirstNames(null), []);
  });
});

describe("formatManagersLabel", () => {
  it("joins co-managers with and", () => {
    assert.equal(formatManagersLabel(["Sadria", "Grayson"]), "Sadria and Grayson");
    assert.equal(formatManagersLabel(["Sam"]), "Sam");
    assert.equal(
      formatManagersLabel(["A", "B", "C"]),
      "A, B, and C",
    );
  });
});

describe("buildPowerRankingBlurbRequest", () => {
  it("adds league-relative ranks, co-managers, and validates", () => {
    const request = buildPowerRankingBlurbRequest({
      leagueName: "Test League",
      seasonYear: 2026,
      editionLabel: "Match 2",
      kind: "match",
      throughMatchupPeriod: 2,
      entries: [
        {
          teamId: 1,
          rank: 1,
          previousRank: 2,
          name: "Swisters in Law",
          abbrev: "SWI",
          ownerName: "Sadria Smith, Grayson Jones",
          powerScore: 40,
          wins: 2,
          losses: 0,
          ties: 0,
          pointsFor: 220,
          pointsAgainst: 180,
          avgScore: 110,
          avgMov: 20,
          dominance: 4,
        },
        {
          teamId: 2,
          rank: 2,
          previousRank: 1,
          name: "Beta",
          abbrev: "BET",
          ownerName: "Jordan Kim",
          powerScore: 30,
          wins: 0,
          losses: 2,
          ties: 0,
          pointsFor: 180,
          pointsAgainst: 220,
          avgScore: 90,
          avgMov: -20,
          dominance: 0,
        },
      ],
      schedule: {
        recentResultsByTeam: new Map([
          [
            1,
            [
              {
                matchupPeriodId: 2,
                opponentTeamId: 2,
                opponentName: "Beta",
                opponentAbbrev: "BET",
                opponentRank: 2,
                score: 115,
                opponentScore: 95,
                margin: 20,
                result: "W",
              },
            ],
          ],
        ]),
        upcomingByTeam: new Map([
          [
            1,
            [
              {
                matchupPeriodId: 3,
                opponentTeamId: 2,
                opponentName: "Beta",
                opponentAbbrev: "BET",
                opponentRank: 2,
              },
            ],
          ],
        ]),
      },
    });

    assert.doesNotThrow(() =>
      powerRankingBlurbRequestSchema.parse(request),
    );
    assert.equal(request.league.format, "redraft_snake");
    assert.deepEqual(request.teams[0]?.managerFirstNames, [
      "Sadria",
      "Grayson",
    ]);
    assert.equal(request.teams[0]?.managersLabel, "Sadria and Grayson");
    assert.equal(request.teams[0]?.rankDelta, 1);
    assert.equal(request.teams[0]?.pfRank, 1);
    assert.equal(request.teams[1]?.paRank, 2);
    assert.equal(request.teams[0]?.roster, null);
    assert.equal(request.teams[0]?.streamingSignal?.applicable, true);
    assert.equal(request.teams[0]?.recentResults.length, 1);
    assert.equal(request.teams[0]?.upcomingOpponents.length, 1);
  });
});
