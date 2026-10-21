/**
 * Invite-only signup gate used by Better Auth `validateUserInfo`.
 * Existing users can still sign in even if removed from the list later.
 */

export function parseAllowedEmails(
  raw: string | undefined | null,
): Set<string> | null {
  if (!raw) return null;
  const emails = raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) return null;
  return new Set(emails);
}

export type InviteOnlyRejection = {
  error: "email_not_allowed";
  errorDescription: string;
};

/** Returns a rejection when signup should be blocked; otherwise undefined. */
export function validateInviteOnlySignup(
  email: string | null | undefined,
  allowlist: Set<string> | null,
): InviteOnlyRejection | undefined {
  if (!allowlist) return undefined;

  const normalized =
    typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalized || !allowlist.has(normalized)) {
    return {
      error: "email_not_allowed",
      errorDescription:
        "This app is invite-only. Your Google account is not authorized.",
    };
  }
  return undefined;
}
