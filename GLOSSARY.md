# Commishop glossary

Domain language for this codebase. Prefer these terms in modules, comments, and architecture notes.

| Term | Meaning |
|------|---------|
| **Fantasy League Connection** | A user’s linked ESPN fantasy basketball league (`fantasy_league`), including optional private-league cookies. |
| **ESPN Adapter** | Server-side modules that read ESPN Fantasy (`shared`, `overview`, `power-feed`, `blurb-context`). |
| **Overview** | Live standings + current/selected matchup week projections for a connected league. |
| **Power Ranking Edition** | A locked snapshot of ranks (`preseason` or `match`) with per-team entries and optional blurbs. |
| **Blurb** | AI-written 4–5 sentence write-up stored on a power-ranking entry. |
| **Publish Job** | Daily cron check: Utah ~10am gate, then create Match N editions when ESPN Eastern calendar says a matchup ended yesterday. |
| **Mock Match Week** | Dev-only seeded matchup periods (`MOCK_MATCHUP_PERIOD_BASE`+) with a deterministic schedule adapter for blurbs. |
| **Active League** | Client-side selection of which connected Fantasy League Connection the dashboard is showing. |
