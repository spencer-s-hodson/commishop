import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseAllowedEmails,
  validateInviteOnlySignup,
} from "@/server/better-auth/allowed-emails";

describe("parseAllowedEmails", () => {
  it("returns null when unset or blank", () => {
    assert.equal(parseAllowedEmails(undefined), null);
    assert.equal(parseAllowedEmails(null), null);
    assert.equal(parseAllowedEmails(""), null);
    assert.equal(parseAllowedEmails("  ,  "), null);
  });

  it("parses comma-separated emails case-insensitively", () => {
    const set = parseAllowedEmails(" Alex@Example.com , bob@test.com ");
    assert.ok(set);
    assert.equal(set.size, 2);
    assert.ok(set.has("alex@example.com"));
    assert.ok(set.has("bob@test.com"));
  });
});

describe("validateInviteOnlySignup", () => {
  it("allows anyone when allowlist is null", () => {
    assert.equal(validateInviteOnlySignup("anyone@x.com", null), undefined);
  });

  it("allows listed emails ignoring case and whitespace", () => {
    const allowlist = parseAllowedEmails("you@gmail.com")!;
    assert.equal(
      validateInviteOnlySignup("  You@Gmail.com ", allowlist),
      undefined,
    );
  });

  it("rejects missing or unlisted emails", () => {
    const allowlist = parseAllowedEmails("you@gmail.com")!;
    assert.equal(
      validateInviteOnlySignup(undefined, allowlist)?.error,
      "email_not_allowed",
    );
    assert.equal(
      validateInviteOnlySignup("other@gmail.com", allowlist)?.error,
      "email_not_allowed",
    );
  });
});
