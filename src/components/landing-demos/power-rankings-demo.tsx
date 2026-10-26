"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { DemoBreadcrumb } from "@/components/landing-demos/demo-breadcrumb";
import {
  DEMO_LEAGUE_NAME,
  powerRankingsDemoEditions,
} from "@/components/landing-demos/fixtures";
import {
  ProductDemo,
  usePrefersReducedMotion,
  type DemoScript,
} from "@/components/landing-demos/product-demo";
import { PowerRankingEntry } from "@/components/power-rankings-dashboard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REORDER_MS = 900;

const row = { zoom: 1.45, align: "start" } as const;

const script: DemoScript = async (demo) => {
  demo.caption("Rankings lock after every matchup");
  await demo.wait(900);
  await demo.focus('[data-rank="1"]', { ...row, dwell: 1400 });
  demo.caption("Every team gets a write-up worth sharing");
  await demo.focus('[data-rank="2"]', { ...row, dwell: 1400 });

  demo.caption("Flip to the newest edition");
  await demo.focus('[data-demo="rankings-header"]', { zoom: 1 });
  await demo.click('[data-demo="edition"]');
  await demo.click('[data-demo="edition-match-5"]');
  demo.caption("See who climbed and who slid");
  await demo.wait(REORDER_MS + 300);
  await demo.focus('[data-rank="3"]', { ...row, zoom: 1.7, dwell: 2000 });

  demo.caption(null);
  await demo.fit();
  await demo.wait(1400);
};

export function PowerRankingsDemo() {
  const [editionIndex, setEditionIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const listRef = useRef<HTMLOListElement>(null);
  const positions = useRef(new Map<string, number>());

  const edition = powerRankingsDemoEditions[editionIndex]!;
  const teamNames = edition.rankings.map((row) => row.name);

  // FLIP: slide each team from its old slot to its new one.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const next = new Map<string, number>();
    for (const item of Array.from(list.children) as HTMLElement[]) {
      const key = item.dataset.teamId ?? "";
      const top = item.offsetTop;
      const previous = positions.current.get(key);
      next.set(key, top);
      if (reducedMotion || previous == null || previous === top) continue;
      item.animate(
        [
          { transform: `translateY(${previous - top}px)` },
          { transform: "translateY(0)" },
        ],
        { duration: REORDER_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    }
    positions.current = next;
  }, [editionIndex, reducedMotion]);

  const reset = useCallback(() => {
    setEditionIndex(0);
    setMenuOpen(false);
  }, []);

  return (
    <ProductDemo
      url="/power-rankings"
      label="Interactive Power Rankings demo"
      script={script}
      onReset={reset}
    >
      <DemoBreadcrumb page="Power Rankings" />

      <div
        data-demo="rankings-header"
        className="mt-5 flex items-end justify-between gap-3"
      >
        <div>
          <h1 className="text-lg font-semibold">Power Rankings</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Locked editions for{" "}
            <span className="text-foreground font-medium">
              {DEMO_LEAGUE_NAME}
            </span>
            {" · "}published {edition.publishedAt} · locked after matchup end.
          </p>
        </div>

        <div className="relative flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">
            Edition
          </span>
          <Button
            data-demo="edition"
            variant="outline"
            size="lg"
            className="min-w-40 justify-between gap-1.5"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setMenuOpen(false);
            }}
          >
            {edition.label}
            <ChevronDownIcon className="opacity-60" />
          </Button>
          {menuOpen ? (
            <div
              role="menu"
              className="bg-popover text-popover-foreground ring-foreground/10 absolute top-full right-0 z-20 mt-1 flex min-w-44 flex-col rounded-lg p-1 shadow-md ring-1"
            >
              {[...powerRankingsDemoEditions]
                .map((item, index) => ({ item, index }))
                .reverse()
                .map(({ item, index }) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    data-demo={`edition-${item.id}`}
                    onClick={() => {
                      setEditionIndex(index);
                      setMenuOpen(false);
                    }}
                    className={cn(
                      "hover:bg-accent focus-visible:bg-accent flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none",
                      index === editionIndex && "font-medium",
                    )}
                  >
                    {item.label}
                    {index === editionIndex ? (
                      <CheckIcon className="size-4" />
                    ) : null}
                  </button>
                ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 px-2">
        <div className="border-border/70 mb-2 border-b pb-4">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Power Rankings
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {DEMO_LEAGUE_NAME}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {edition.label} · published {edition.publishedAt}
          </p>
        </div>

        <ol ref={listRef} className="flex flex-col">
          {edition.rankings.map((team) => (
            <li
              key={team.teamId}
              data-team-id={team.teamId}
              data-rank={team.rank}
              className="border-border/70 bg-background relative border-b py-5 last:border-b-0"
            >
              <PowerRankingEntry team={team} teamNames={teamNames} />
            </li>
          ))}
        </ol>
      </div>
    </ProductDemo>
  );
}
