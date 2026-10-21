import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    BETTER_AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    BETTER_AUTH_GOOGLE_CLIENT_ID: z.string().optional(),
    BETTER_AUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
    /**
     * Comma-separated emails allowed to create an account (Google or email/password).
     * Existing users can still sign in. When unset, new signups are open.
     */
    AUTH_ALLOWED_EMAILS: z.string().min(1).optional(),
    DATABASE_URL: z.string().url(),
    /** Shared secret for /api/cron/* (Vercel Cron Authorization bearer). */
    CRON_SECRET: z.string().min(1).optional(),
    /** OpenAI API key for power-ranking blurbs via the OpenAI SDK (optional; blurbs skipped if unset). */
    OPENAI_API_KEY: z.string().min(1).optional(),
    /** Chat model for 4–5 sentence power-ranking write-ups. */
    OPENAI_POWER_RANKINGS_MODEL: z.string().min(1).default("gpt-6-luna"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_GOOGLE_CLIENT_ID: process.env.BETTER_AUTH_GOOGLE_CLIENT_ID,
    BETTER_AUTH_GOOGLE_CLIENT_SECRET:
      process.env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
    AUTH_ALLOWED_EMAILS: process.env.AUTH_ALLOWED_EMAILS,
    DATABASE_URL: process.env.DATABASE_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_POWER_RANKINGS_MODEL: process.env.OPENAI_POWER_RANKINGS_MODEL,
    NODE_ENV: process.env.NODE_ENV,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
