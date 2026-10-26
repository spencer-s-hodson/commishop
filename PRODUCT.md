# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Fantasy basketball managers who play in ESPN leagues and want an edge in matchups, roster moves, and trades.

## Product Purpose

Commishop connects an ESPN fantasy basketball league and surfaces matchup intel, weekly power rankings, and trade analysis so managers can make better decisions and win more matchups.

## Positioning

ESPN-league tools in one place: live matchups and projections, power rankings by week, and a trade analyzer — not a generic fantasy news site.

## Operating Context

Managers sign in, connect an ESPN league, then use Overview (matchups), Power Rankings, and Trade Analyzer during the season. Marketing entry is a landing page; authenticated product lives under dashboard routes.

## Capabilities and Constraints

- Auth: email/password and Google
- Features: Overview, Power Rankings, Trade Analyzer
- ESPN league connection required for league-scoped data
- Landing lives at `/landing` until promoted to root

## Brand Commitments

- Name: Commishop
- Mark: volt basketball on ink tile (`/brand/commishop-mark.svg`, `CommishopLogo`)
- Visual system: "volt on paper" — lime/volt accent (`#C2F51C` / brand tokens), ink rail, Archivo (expanded) + JetBrains Mono
- Voice from auth shell: direct, competitive ("Win more matchups. Smarter tools.")

## Evidence on Hand

- Live product UI: Overview, Power Rankings, Trade Analyzer
- Brand assets under `public/brand/`
- No third-party testimonials, customer logos, or benchmarks — do not invent them

## Product Principles

1. Show the product working — real screenshots beat abstract claims.
2. Lead with ESPN connection and the three core tools.
3. Stay honest: no fabricated social proof or metrics.
4. Preserve the existing volt/ink brand; do not invent a parallel marketing look.
5. Primary action is signup / get started for managers.

## Accessibility & Inclusion

Standard web accessibility; no product-specific requirements recorded yet.
