import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyToNull,
  privateLeagueCredentialsError,
} from "@/server/api/league-connect";

describe("emptyToNull", () => {
  it("trims and nulls blanks", () => {
    assert.equal(emptyToNull(undefined), null);
    assert.equal(emptyToNull(""), null);
    assert.equal(emptyToNull("   "), null);
    assert.equal(emptyToNull(" abc "), "abc");
  });
});

describe("privateLeagueCredentialsError", () => {
  it("allows public (neither) and private (both)", () => {
    assert.equal(privateLeagueCredentialsError(null, null), null);
    assert.equal(privateLeagueCredentialsError("s2", "{swid}"), null);
  });

  it("rejects a partial cookie pair", () => {
    assert.match(
      privateLeagueCredentialsError("s2", null) ?? "",
      /both espn_s2 and SWID/,
    );
    assert.match(
      privateLeagueCredentialsError(null, "{swid}") ?? "",
      /both espn_s2 and SWID/,
    );
  });
});
