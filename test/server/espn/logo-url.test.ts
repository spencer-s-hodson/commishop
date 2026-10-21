import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isEspnCustomLogoUrl, toDisplayLogoUrl } from "@/server/espn/logo-url";

describe("isEspnCustomLogoUrl", () => {
  it("detects mystique custom uploads", () => {
    assert.equal(
      isEspnCustomLogoUrl(
        "https://mystique-api.fantasy.espn.com/apis/v1/domains/lm/images/abc",
      ),
      true,
    );
    assert.equal(
      isEspnCustomLogoUrl("https://a.espncdn.com/i/teamlogos/nba/500/lal.png"),
      false,
    );
    assert.equal(isEspnCustomLogoUrl("not-a-url"), false);
  });
});

describe("toDisplayLogoUrl", () => {
  it("returns null for missing logos", () => {
    assert.equal(toDisplayLogoUrl(null, "league-1"), null);
  });

  it("passes through public CDN logos", () => {
    const src = "https://a.espncdn.com/i/teamlogos/nba/500/lal.png";
    assert.equal(toDisplayLogoUrl(src, "league-1"), src);
  });

  it("proxies custom ESPN logos through /api/espn/logo", () => {
    const src =
      "https://mystique-api.fantasy.espn.com/apis/v1/domains/lm/images/abc";
    const out = toDisplayLogoUrl(src, "league-1");
    assert.ok(out?.startsWith("/api/espn/logo?"));
    assert.ok(out?.includes("leagueId=league-1"));
    assert.ok(out?.includes(encodeURIComponent(src).slice(0, 20)));
  });
});
