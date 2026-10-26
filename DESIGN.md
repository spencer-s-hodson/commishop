---
name: Commishop
description: ESPN fantasy basketball tools — volt on paper.
colors:
  brand: "oklch(0.91 0.215 128)"
  brand-ink: "oklch(0.5 0.13 132)"
  background: "oklch(0.982 0.004 120)"
  foreground: "oklch(0.17 0.012 125)"
  card: "oklch(1 0 0)"
  muted: "oklch(0.955 0.005 120)"
  muted-foreground: "oklch(0.47 0.012 125)"
  accent: "oklch(0.955 0.035 126)"
  border: "oklch(0.905 0.007 120)"
  input: "oklch(0.875 0.008 120)"
  ring: "oklch(0.72 0.19 130)"
  destructive: "oklch(0.577 0.215 27)"
  sidebar: "oklch(0.165 0.01 125)"
  sidebar-foreground: "oklch(0.9 0.006 120)"
  sidebar-accent: "oklch(0.245 0.013 125)"
  mark-volt: "#C2F51C"
  mark-ink: "#15180F"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.03em"
    fontVariation: "wdth 118"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 3vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontVariation: "wdth 118"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
    fontVariation: "wdth 118"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "0.3rem"
  md: "0.4rem"
  lg: "0.5rem"
  xl: "0.7rem"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  section: "4rem"
  container: "72rem"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0.625rem 1.25rem"
    height: "2.75rem"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "oklch(0.91 0.215 128 / 0.8)"
    textColor: "{colors.foreground}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0.625rem 1.25rem"
    height: "2.75rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0.375rem 0.625rem"
    height: "1.75rem"
  input-field:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0.25rem 0.625rem"
    height: "2rem"
  ink-panel:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.sidebar-foreground}"
    rounded: "0"
  product-shot:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.xl}"
---

# Design System: Commishop

## Overview

**Creative North Star: "Volt on Paper"**

Commishop is a lime-forward product UI on a pale lime-cast ground. Neutrals sit in hue ~120–125 so the volt accent feels native, not pasted. The ink rail (sidebar) is the one intentional dark surface in the light app — used for navigation and for high-contrast marketing panels that reuse the same dark language as auth.

Display type is Archivo pushed wide (`font-stretch: 118%`), heavy and tight. JetBrains Mono owns data, code, and tabular accents. Brand volt is a fill color; when the brand hue must read as text on light surfaces, use brand-ink. The mark is a volt basketball on an ink tile (`#C2F51C` / `#15180F`).

Marketing and product share one world. Persuasion surfaces prove the product with real screenshots, not abstract fantasy-sports imagery. Court-dot texture (radial brand dots) belongs on hero and empty ink panels — the same device as the auth shell.

**Key Characteristics:**
- Volt fill on lime-cast paper; brand-ink for readable brand text
- Ink rail as the sole dark panel language
- Archivo expanded display + JetBrains Mono data
- Soft ambient shadows on product shots only; flat UI at rest
- Court-dot texture on hero / ink panels, masked and low-opacity

## Colors

A single volt accent rides a lime-cast neutral stack; ink is the dark counterpart, not a second accent family.

### Primary
- **Volt** (`oklch(0.91 0.215 128)` / mark `#C2F51C`): Brand fill — primary buttons, selection, sidebar primary, chart highlight, accent blur orbs. Never the default body text color on paper.
- **Brand Ink** (`oklch(0.5 0.13 132)`): Readable brand-hue text on light surfaces (hero wordmark, caret). Dark mode lightens this token for contrast on ink.

### Neutral
- **Paper** (`oklch(0.982 0.004 120)`): App and marketing background.
- **Ink** (`oklch(0.17 0.012 125)`): Primary text / foreground; mark tile `#15180F`.
- **Card White** (`oklch(1 0 0)`): Elevated content surfaces.
- **Muted Lime** (`oklch(0.955 0.005 120)`): Alternating section washes, soft fills.
- **Muted Text** (`oklch(0.47 0.012 125)`): Supporting copy.
- **Border / Input** (`oklch(0.905 0.007 120)` / `oklch(0.875 0.008 120)`): Hairline structure and field strokes.
- **Ring** (`oklch(0.72 0.19 130)`): Focus ring, volt-adjacent.

### Dark surface
- **Ink Rail** (`oklch(0.165 0.01 125)`): Sidebar and dark marketing/auth panels (`.dark` + `bg-sidebar`). Foreground `oklch(0.9 0.006 120)`; volt remains the accent on ink.

### Named Rules
**The Fill-Not-Text Rule.** Volt is a fill. On paper, brand-colored text uses brand-ink (or ink foreground), never raw volt at body sizes.

**The One Dark Surface Rule.** The only dark canvas is the ink rail language (`sidebar` tokens). Do not invent a second dark theme palette for marketing.

## Typography

**Display Font:** Archivo (variable width axis, expanded to 118%)
**Body Font:** Archivo (default width)
**Label/Mono Font:** JetBrains Mono

**Character:** Competitive and direct — heavy expanded display for claims and brand, quiet sans for body, mono only where numbers or code earn it.

### Hierarchy
- **Display** (800, ~clamp 2.25–4.5rem, line-height ~0.92–0.95, tracking −0.03em, stretch 118%): Brand wordmark and ink-panel claims ("Win more matchups.", "Connect ESPN.").
- **Headline** (800, ~1.875–3rem, line-height ~1.05, stretch 118%): Section and page titles.
- **Title** (800, ~1.125rem, tight tracking, often uppercase in the logo wordmark): Compact brand lockups.
- **Body** (400, 1rem–1.125rem, relaxed leading): Supporting copy; prefer muted-foreground for secondary lines; keep max width ~36rem on marketing strips.
- **Label** (500, ~0.8–0.875rem): Buttons and UI chrome.
- **Mono** (400, JetBrains Mono): `code`, `kbd`, `samp`, `pre`; tabular nums on tables and time.

### Named Rules
**The Expanded Display Rule.** Headings and `.font-heading` always use Archivo at ~118% stretch with tight negative tracking. Do not substitute a second display face.

**The Mono-For-Data Rule.** JetBrains Mono is for data and code accents, not marketing headlines.

## Layout

Content locks to a **max-width 72rem** (`max-w-6xl`) gutters **1.5rem** mobile / **2rem** desktop. Marketing sections use generous vertical rhythm (**4rem** mobile, **6rem** desktop). Feature strips are a two-column grid at large breakpoints with alternating image/copy order; odd strips wash with muted paper.

Hero marketing is full-bleed: brand + headline + support + CTA sit above a full-width product viewport that reads as the visual plane, not an inset card. App chrome keeps the ink sidebar as the persistent dark rail against paper content.

Density is product-comfortable: controls default to compact heights (buttons ~2–2.75rem, inputs 2rem); marketing CTAs bump to large height without changing radius language.

## Elevation & Depth

Most UI is flat: borders and tonal washes (`muted`, `accent`) carry structure. Soft ambient shadows appear on **product screenshots** and on hover-lift of those shots — not on resting cards or buttons.

### Shadow Vocabulary
- **Shot rest** (`box-shadow: 0 18px 50px -28px oklch(0.17 0.012 125 / 0.4)`): Feature-strip product images with a light border.
- **Shot lift** (`box-shadow: 0 22px 56px -28px oklch(0.17 0.012 125 / 0.5)` + `translateY(-4px)`): Hover on feature shots (fine pointer only).
- **Volt wash**: Soft radial brand gradients and blurred brand orbs on hero/ink panels — atmospheric, not structural elevation.

### Named Rules
**The Flat-By-Default Rule.** Surfaces rest flat. Shadows are reserved for product imagery and its hover response.

**The Court-Dot Rule.** `.bg-court-dots` (14×14px radial brand dots) textures hero and ink panels at reduced opacity with a mask; do not tile it as a full opaque wallpaper.

## Shapes

Base radius is **0.5rem** (`--radius`). Scale: sm ≈ 0.3rem, md ≈ 0.4rem, lg 0.5rem, xl ≈ 0.7rem. Buttons and inputs use **gently rounded** (`rounded-lg`). Product shots in feature strips use **xl** corners with a hairline border. The mark tile uses **~7px** corners on a 32px viewBox. Ink panels and the hero shot plane are **square / edge-to-edge** — no card chrome on the hero viewport.

Borders are quiet (`border` / `border/60–70%`). Focus uses ring at 3px with ring color at 50% opacity.

## Components

### Buttons
Confident volt fills for primary actions; outline and ghost for secondary paths.

- **Shape:** Gently rounded (`rounded-lg` / `{rounded.lg}`)
- **Primary:** Volt fill, ink foreground text; hover fades fill to ~80% opacity
- **Outline:** Paper fill, border stroke; hover muted wash
- **Ghost:** Transparent; hover muted wash (header Sign in)
- **Focus:** Ring + border shift to ring token; active presses `translateY(1px)` when not a popup trigger
- **Marketing large:** Height ~2.75rem, padding ~0.625rem 1.25rem, text-base

### Inputs / Fields
- **Style:** Transparent fill, input-border stroke, `rounded-lg`, height 2rem, horizontal padding 0.625rem
- **Focus:** Border and 3px ring in ring token
- **Error:** Destructive border + ring; disabled dims opacity and softens background

### Navigation
- **App:** Ink sidebar (`sidebar` tokens) with volt primary accents and sidebar-accent hover/active
- **Marketing header:** Absolute over hero; logo lockup left, ghost + primary buttons right; height 4–5rem

### Commishop Mark
Volt basketball (`#C2F51C`) with ink seams on ink rounded tile (`#15180F`). Optional Archivo wordmark: extrabold, tight, uppercase. Prefer `CommishopLogo` / `/brand/commishop-mark.svg` — do not redraw the mark.

### Product Shot
Real UI screenshots only. Feature strips: bordered, rounded-xl, soft ambient shadow, optional hover lift. Hero: full-bleed edge plane (`object-cover` / `object-top`), parallax float on scroll (≤48px), no card frame.

### Ink Panel (signature)
Dark marketing/auth panel: `dark` + `bg-sidebar`, court dots + soft volt orb, expanded display claim with a volt-colored accent phrase (`text-brand`), muted supporting line, primary CTA.

### Landing Motion (signature)
- **LandingParallax:** Hero shot translates with scroll (`scrollY * 0.12`, capped at 48px)
- **LandingReveal:** Sections fade/slide up (650ms, ease `cubic-bezier(0.16, 1, 0.3, 1)`); content stays visible until client arms reveal
- Prefer reduced-motion: disable animations and leave content visible
- Hero copy uses `landing-fade-up` (700ms); hero shot uses `landing-hero-shot` (900ms, 120ms delay)

## Do's and Don'ts

### Do:
- **Do** keep volt as a fill and use brand-ink when the brand hue must read as text on paper.
- **Do** reuse ink-rail (`sidebar`) tokens for any dark panel — auth, landing CTA, app nav.
- **Do** set display headings in Archivo expanded (~118% stretch), weight 800, tight tracking.
- **Do** prove marketing claims with real product screenshots from `/marketing/`.
- **Do** apply court-dot texture the way auth and landing do: masked, low opacity, over paper or ink.

### Don't:
- **Don't** invent a parallel marketing palette (purple gradients, cream editorial, broadsheet rules).
- **Don't** set body copy in volt yellow on paper.
- **Don't** wrap the hero product viewport in a card, inset media frame, or floating collage.
- **Don't** use JetBrains Mono for display headlines.
- **Don't** invent testimonials, logos, or metrics the product does not have.
