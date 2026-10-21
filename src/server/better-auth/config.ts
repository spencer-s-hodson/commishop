import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { env } from "@/env";
import { db } from "@/server/db";

const googleEnabled =
  !!env.BETTER_AUTH_GOOGLE_CLIENT_ID &&
  !!env.BETTER_AUTH_GOOGLE_CLIENT_SECRET;

function allowedEmails() {
  if (!env.AUTH_ALLOWED_EMAILS) return null;
  return new Set(
    env.AUTH_ALLOWED_EMAILS.split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const auth = betterAuth({
  appName: "Commishop",
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    ...(googleEnabled
      ? {
          google: {
            clientId: env.BETTER_AUTH_GOOGLE_CLIENT_ID!,
            clientSecret: env.BETTER_AUTH_GOOGLE_CLIENT_SECRET!,
          },
        }
      : {}),
  },
  user: {
    // Blocks new account creation (Google first login + email signup) unless
    // the email is in AUTH_ALLOWED_EMAILS. Existing users can still sign in.
    validateUserInfo: ({ user }) => {
      const allowlist = allowedEmails();
      if (!allowlist) return;

      const email =
        typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
      if (!email || !allowlist.has(email)) {
        return {
          error: "email_not_allowed",
          errorDescription:
            "This app is invite-only. Your Google account is not authorized.",
        };
      }
    },
  },
  // Must be last so Set-Cookie from auth responses is applied in Next.js.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
