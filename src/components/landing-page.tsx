import Link from "next/link";
import {
  ArrowLeftRightIcon,
  ArrowRightIcon,
  LayoutDashboardIcon,
  ListOrderedIcon,
} from "lucide-react";

import { CommishopLogo } from "@/components/commishop-logo";
import { LiveMatchupCard } from "@/components/landing-demos/live-matchup-card";
import { OverviewDemo } from "@/components/landing-demos/overview-demo";
import { PowerRankingsDemo } from "@/components/landing-demos/power-rankings-demo";
import { TradeDemo } from "@/components/landing-demos/trade-demo";
import { LandingReveal } from "@/components/landing-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const productLinks = [
  {
    href: "#overview",
    label: "Matchup overview",
    icon: LayoutDashboardIcon,
  },
  {
    href: "#power-rankings",
    label: "Power rankings",
    icon: ListOrderedIcon,
  },
  {
    href: "#trade-analyzer",
    label: "Trade analyzer",
    icon: ArrowLeftRightIcon,
  },
] as const;

const features = [
  {
    id: "overview",
    title: "Matchups that actually matter",
    body: "Every head-to-head with scores, projections, games left, and win probability — so you know who’s winning the week before tip-off.",
    Demo: OverviewDemo,
  },
  {
    id: "power-rankings",
    title: "Power rankings, locked each week",
    body: "Published editions with movement and write-ups for every team — the story behind the standings, ready to share with the league.",
    Demo: PowerRankingsDemo,
  },
  {
    id: "trade-analyzer",
    title: "Trade desk built for ESPN leagues",
    body: "Line up two teams, pick the players, and compare value and lineup fit before you send the offer.",
    Demo: TradeDemo,
  },
] as const;

const pillars = [
  {
    title: "Connect ESPN",
    body: "Link your league once and pull live matchups, rosters, and scoring into Commishop.",
  },
  {
    title: "Read the week",
    body: "Win probability, projections, and power rankings that update with the season.",
  },
  {
    title: "Make the move",
    body: "Stress-test trades on value and fit before you spam the league chat.",
  },
] as const;

const ctaClass =
  "h-12 gap-2 px-6 text-base font-semibold sm:h-14 sm:px-8 sm:text-lg";

export function LandingPage() {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="border-border/60 bg-background/90 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:h-18 sm:px-6 md:px-8">
          <Link href="/landing" className="flex min-w-0 items-center gap-2">
            <CommishopLogo size={28} withWordmark />
          </Link>
          <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href="/login" />}
              className="hidden h-11 px-4 text-base font-medium sm:inline-flex"
            >
              Sign in
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/signup" />}
              className="h-11 gap-1.5 px-4 text-sm font-semibold sm:px-5 sm:text-base"
            >
              Get started
              <ArrowRightIcon className="size-4" />
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero — STACKED-style split: copy left, contained product right */}
        <section className="relative isolate overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_0%_0%,oklch(from_var(--brand)_l_c_h_/_0.18),transparent_55%)]"
          />
          <div
            aria-hidden
            className="bg-court-dots pointer-events-none absolute inset-0 mask-[radial-gradient(ellipse_70%_60%_at_85%_20%,black,transparent)] opacity-30"
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pt-10 pb-12 sm:gap-10 sm:px-6 sm:pt-14 sm:pb-16 md:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14 lg:pt-16 lg:pb-20">
            <div className="landing-fade-up flex flex-col items-start">
              <h1 className="font-heading text-4xl leading-[0.98] font-extrabold tracking-tight sm:text-5xl md:text-6xl">
                Win more
                <br />
                matchups.
              </h1>
              <p className="text-muted-foreground mt-5 max-w-md text-base leading-relaxed sm:text-lg">
                Connect your ESPN league and get matchup intel, power rankings,
                and trade analysis built for fantasy basketball.
              </p>

              <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  nativeButton={false}
                  render={<Link href="/signup" />}
                  className={cn(ctaClass, "w-full sm:w-auto")}
                >
                  Get started
                  <ArrowRightIcon className="size-5" />
                </Button>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/login" />}
                  className={cn(ctaClass, "w-full sm:w-auto")}
                >
                  Sign in
                </Button>
              </div>

              <div className="mt-7 flex flex-wrap gap-2">
                {productLinks.map((link) => (
                  <Badge
                    key={link.href}
                    variant="outline"
                    render={<a href={link.href} />}
                    className="h-10 gap-2 rounded-lg px-3.5 text-sm font-medium"
                  >
                    <link.icon className="size-4 opacity-70" />
                    {link.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="landing-hero-shot relative mx-auto w-full max-w-sm sm:max-w-md lg:ml-auto lg:max-w-[400px]">
              <LiveMatchupCard className="rounded-xl shadow-[0_24px_60px_-28px_oklch(0.17_0.012_125_/_0.45)]" />
            </div>
          </div>
        </section>

        <Separator />

        {/* Feature showcase — STACKED mid-page: title + contained product card */}
        <section className="bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 md:px-8">
            <LandingReveal className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                Tools for every decision this week
              </h2>
              <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
                Overview, power rankings, and a trade desk — synced to your ESPN
                league so the analysis matches how you actually play.
              </p>
            </LandingReveal>

            <div className="mt-12 flex flex-col gap-16 sm:mt-16 sm:gap-24">
              {features.map((feature) => (
                <div
                  key={feature.id}
                  id={feature.id}
                  className="flex scroll-mt-24 flex-col gap-6 sm:gap-8"
                >
                  <LandingReveal className="max-w-2xl">
                    <h3 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground mt-3 text-base leading-relaxed sm:text-lg">
                      {feature.body}
                    </p>
                  </LandingReveal>
                  <LandingReveal>
                    <feature.Demo />
                  </LandingReveal>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pillars — STACKED bento-style, three equal jobs */}
        <section className="border-border/60 border-t">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 md:px-8">
            <LandingReveal className="max-w-xl">
              <h2 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
                From sync to send
              </h2>
              <p className="text-muted-foreground mt-3 text-base leading-relaxed sm:text-lg">
                One flow for managers who want the edge without jumping across
                five tabs.
              </p>
            </LandingReveal>

            <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-5">
              {pillars.map((pillar) => (
                <LandingReveal key={pillar.title}>
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="font-heading text-lg font-extrabold tracking-tight sm:text-xl">
                        {pillar.title}
                      </CardTitle>
                      <CardDescription className="text-sm leading-relaxed sm:text-base">
                        {pillar.body}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </LandingReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA — STACKED edge band */}
        <section className="dark bg-sidebar text-foreground relative overflow-hidden">
          <div
            aria-hidden
            className="bg-court-dots absolute inset-0 mask-[radial-gradient(ellipse_80%_70%_at_90%_10%,black,transparent)] opacity-55"
          />
          <div
            aria-hidden
            className="absolute -right-20 -bottom-24 size-[22rem] rounded-full bg-[oklch(from_var(--brand)_l_c_h_/_0.2)] blur-3xl"
          />
          <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 sm:py-24 md:px-8">
            <h2 className="font-heading max-w-2xl text-3xl leading-[0.98] font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              Connect ESPN.
              <br />
              <span className="text-brand">Play smarter.</span>
            </h2>
            <p className="text-muted-foreground max-w-lg text-base leading-relaxed sm:text-lg">
              Overview, power rankings, and trade analysis in one place — built
              for managers who want the edge this week.
            </p>
            <Button
              nativeButton={false}
              render={<Link href="/signup" />}
              className={cn(ctaClass, "w-full sm:w-auto")}
            >
              Create your account
              <ArrowRightIcon className="size-5" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-border/60 bg-background border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 md:px-8">
          <div className="text-foreground flex items-center gap-2">
            <CommishopLogo size={20} />
            <span className="font-medium">Commishop</span>
          </div>
          <p>Fantasy basketball tools for ESPN leagues</p>
        </div>
      </footer>
    </div>
  );
}
