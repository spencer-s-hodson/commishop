import "server-only";

import OpenAI from "openai";

import { env } from "@/env";
import {
  POWER_RANKING_BLURB_SYSTEM_PROMPT,
  powerRankingBlurbsResponseSchema,
  type PowerRankingBlurbRequest,
} from "@/server/espn/power-ranking-blurb-prompt";

function countSentences(text: string) {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length;
}

/**
 * Generate 4–5 sentence blurbs for every team via the OpenAI SDK.
 * Returns an empty map when OPENAI_API_KEY is unset (blurbs stay null).
 */
export async function generatePowerRankingBlurbs(
  request: PowerRankingBlurbRequest,
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (request.teams.length === 0) return result;

  if (!env.OPENAI_API_KEY) {
    console.warn(
      "[power-rankings] OPENAI_API_KEY missing — skipping blurb generation",
    );
    return result;
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: env.OPENAI_POWER_RANKINGS_MODEL,
    // Luna: keep reasoning off so temperature + JSON mode work on Chat Completions.
    reasoning_effort: "none",
    temperature: 0.85,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: POWER_RANKING_BLURB_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          "Write power-ranking blurbs for every team in this JSON payload.",
          "Honor the system instructions (redraft; fantasy team names only; third person they/their/them for each team — never you/your or it/its; record + PF + strength of schedule explained via named opponents — never quote SOS decimals; PA as schedule signal; headliners for preseason; match-only streamingSignal when flagged; no position-group ranks; no defense framing; go light on DTD; 4–5 meaty sentences).",
          "Return JSON only.",
          "",
          JSON.stringify(request),
        ].join("\n"),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty blurb response.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new Error("OpenAI returned non-JSON blurbs.");
  }

  const parsed = powerRankingBlurbsResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(
      `OpenAI blurb JSON failed validation: ${parsed.error.message}`,
    );
  }

  const knownIds = new Set(request.teams.map((team) => team.teamId));
  for (const row of parsed.data.blurbs) {
    if (!knownIds.has(row.teamId)) continue;
    const trimmed = row.blurb.trim();
    if (!trimmed) continue;
    // Prefer 4–5 sentences; accept a wider window so model drift still lands.
    const sentences = countSentences(trimmed);
    if (sentences < 2 || sentences > 8) {
      console.warn(
        `[power-rankings] skipping team ${row.teamId} blurb (${sentences} sentences)`,
      );
      continue;
    }
    result.set(row.teamId, trimmed);
  }

  return result;
}
