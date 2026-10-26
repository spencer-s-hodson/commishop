"use client";

import { useEffect, useState } from "react";

import {
  OVERVIEW_COMEBACK_INDEX,
  overviewDemoSeeds,
  overviewMatchupAt,
} from "@/components/landing-demos/fixtures";
import {
  useInView,
  usePrefersReducedMotion,
} from "@/components/landing-demos/product-demo";
import { MatchupCard } from "@/components/overview-dashboard";
import { cn } from "@/lib/utils";

const seed = overviewDemoSeeds[OVERVIEW_COMEBACK_INDEX]!;
const START = 0.05;
const STEP = 0.01;
const TICK_MS = 220;
const HOLD_TICKS = 14;
/** Shown without motion: just past the lead change. */
const STILL_PROGRESS = 0.72;

/** Hero card: the real matchup card replaying a comeback on a loop. */
export function LiveMatchupCard({ className }: { className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.2);
  const reducedMotion = usePrefersReducedMotion();
  // Ticks past 1 are a hold on the final score before the loop restarts.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const lastTick = Math.ceil((1 - START) / STEP) + HOLD_TICKS;
    const id = setInterval(() => {
      setTick((current) => (current >= lastTick ? 0 : current + 1));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [inView, reducedMotion]);

  const progress = reducedMotion
    ? STILL_PROGRESS
    : Math.min(1, START + tick * STEP);
  const final = progress >= 1;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <span className="bg-background ring-foreground/10 absolute -top-3 right-4 z-10 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase shadow-sm ring-1">
        <span
          className={cn(
            "size-1.5 rounded-full",
            final ? "bg-muted-foreground" : "animate-pulse bg-red-500",
          )}
        />
        {final ? "Final" : "Live"}
      </span>
      <MatchupCard
        matchup={overviewMatchupAt(seed, progress)}
        index={0}
        isCategoryLeague={false}
      />
    </div>
  );
}
