"use client";

import { ChevronDownIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DemoBreadcrumb } from "@/components/landing-demos/demo-breadcrumb";
import {
  DEMO_LEAGUE_NAME,
  OVERVIEW_COMEBACK_INDEX,
  overviewDemoSeeds,
  overviewMatchupAt,
} from "@/components/landing-demos/fixtures";
import {
  ProductDemo,
  type DemoScript,
} from "@/components/landing-demos/product-demo";
import { MatchupCard } from "@/components/overview-dashboard";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CommishopLogo } from "@/components/commishop-logo";

const START_PROGRESS = 0.1;
/** Progress added per tick; the comeback lands ~9s into the script. */
const PROGRESS_STEP = 0.016;
const TICK_MS = 250;

const card = (index: number) => `[data-demo="matchup-${index}"]`;

export function OverviewDemo() {
  const [progress, setProgress] = useState(START_PROGRESS);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      setProgress((current) => Math.min(1, current + PROGRESS_STEP));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [live]);

  const reset = useCallback(() => {
    setLive(false);
    setProgress(START_PROGRESS);
  }, []);

  const script = useCallback<DemoScript>(async (demo) => {
    demo.caption("Every matchup in your league, live");
    setLive(true);
    await demo.wait(1600);
    await demo.focus(card(0), { zoom: 1.75 });
    demo.caption("Scores, projections, and games left update as you watch");
    await demo.wait(1500);
    await demo.focus(`${card(0)} [data-slot="win-probability"]`, {
      zoom: 2.3,
      dwell: 1800,
    });
    demo.caption("Watch the odds swing as games finish");
    await demo.focus(card(OVERVIEW_COMEBACK_INDEX), { zoom: 1.75 });
    await demo.focus(
      `${card(OVERVIEW_COMEBACK_INDEX)} [data-slot="win-probability"]`,
      { zoom: 2.3, dwell: 3200 },
    );
    demo.caption(null);
    await demo.fit();
    await demo.wait(1600);
  }, []);

  return (
    <ProductDemo
      url="/overview?week=6"
      label="Interactive matchup overview demo"
      script={script}
      onReset={reset}
    >
      <DemoBreadcrumb page="Overview" />

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="bg-sidebar flex size-10 items-center justify-center rounded-full">
            <CommishopLogo size={24} />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">
            {DEMO_LEAGUE_NAME}
          </h1>
          <Badge className="border-transparent bg-brand text-black">
            Current week
          </Badge>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">
            Matchup week
          </span>
          <div
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "min-w-44 justify-between gap-1.5",
            )}
          >
            Matchup 6 (Nov 24–30) · now
            <ChevronDownIcon className="opacity-60" />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-medium">Matchup 6 matchups</h2>
        <p className="text-muted-foreground text-sm">
          Live scores and projected win odds for the current matchup period.
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-4">
        {overviewDemoSeeds.map((seed, index) => (
          <div key={index} data-demo={`matchup-${index}`}>
            <MatchupCard
              matchup={overviewMatchupAt(seed, progress)}
              index={index}
              isCategoryLeague={false}
            />
          </div>
        ))}
      </div>
    </ProductDemo>
  );
}
