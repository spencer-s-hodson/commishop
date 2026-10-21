import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cronSecretFromRequest,
  isAuthorizedCronRequest,
} from "@/server/cron/authorize";

describe("isAuthorizedCronRequest", () => {
  it("rejects when secret is unset", () => {
    assert.equal(isAuthorizedCronRequest("anything", undefined), false);
    assert.equal(isAuthorizedCronRequest("anything", null), false);
    assert.equal(isAuthorizedCronRequest("anything", ""), false);
  });

  it("requires an exact match", () => {
    assert.equal(isAuthorizedCronRequest("secret", "secret"), true);
    assert.equal(isAuthorizedCronRequest("wrong", "secret"), false);
    assert.equal(isAuthorizedCronRequest(null, "secret"), false);
  });
});

describe("cronSecretFromRequest", () => {
  it("prefers Bearer over query secret", () => {
    const request = new Request(
      "https://example.com/api/cron/power-rankings?secret=query",
      { headers: { authorization: "Bearer header-secret" } },
    );
    assert.equal(cronSecretFromRequest(request), "header-secret");
  });

  it("falls back to ?secret=", () => {
    const request = new Request(
      "https://example.com/api/cron/power-rankings?secret=query-only",
    );
    assert.equal(cronSecretFromRequest(request), "query-only");
  });

  it("returns null when neither is present", () => {
    const request = new Request("https://example.com/api/cron/power-rankings");
    assert.equal(cronSecretFromRequest(request), null);
  });
});
