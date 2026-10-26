"use client";

import { ArrowLeftRightIcon, RotateCcwIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  DEMO_LEAGUE_NAME,
  tradeDemoContext,
  tradeDemoPlayerId,
  tradeDemoSides,
  tradeDemoTeams,
} from "@/components/landing-demos/fixtures";
import { DemoBreadcrumb } from "@/components/landing-demos/demo-breadcrumb";
import {
  ProductDemo,
  type DemoScript,
} from "@/components/landing-demos/product-demo";
import {
  ImpactCard,
  RosterPanel,
  VerdictBanner,
} from "@/components/trade-analyzer-dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { analyzeTrade } from "@/lib/trade-analysis";

const { a: bucketBrigade, b: glassCleaners } = tradeDemoSides;

const player = {
  haliburton: tradeDemoPlayerId(bucketBrigade, "Tyrese Haliburton"),
  jalenWilliams: tradeDemoPlayerId(glassCleaners, "Jalen Williams"),
  mitchell: tradeDemoPlayerId(glassCleaners, "Donovan Mitchell"),
  gordon: tradeDemoPlayerId(glassCleaners, "Aaron Gordon"),
};

const row = (playerId: number) => `[data-player-id="${playerId}"]`;
const verdict = '[data-demo="verdict"] [data-slot="verdict-summary"]';

const script: DemoScript = async (demo) => {
  demo.caption("Line up any two teams in your league");
  await demo.wait(900);
  await demo.focus('[data-demo="roster-a"]', { zoom: 1.45 });
  demo.caption("Tap players to build the deal");
  await demo.click(row(player.haliburton));
  await demo.focus('[data-demo="roster-b"]', { zoom: 1.45 });
  await demo.click(row(player.jalenWilliams));

  demo.caption("The verdict updates with every pick");
  await demo.focus(verdict, { zoom: 1.7, dwell: 1200 });
  demo.caption("Value, lineup strength, and rank, side by side");
  await demo.focus('[data-demo="impact-a"]', { dwell: 1800 });

  demo.caption("Rework the offer until it's fair");
  await demo.focus('[data-demo="roster-b"]', { zoom: 1.45 });
  await demo.click(row(player.jalenWilliams));
  await demo.click(row(player.mitchell));
  await demo.click(row(player.gordon));
  await demo.focus(verdict, { zoom: 1.7, dwell: 1600 });

  demo.caption(null);
  await demo.fit();
  await demo.wait(1400);
};

const toggle = (list: number[], playerId: number) =>
  list.includes(playerId)
    ? list.filter((id) => id !== playerId)
    : [...list, playerId];

export function TradeDemo() {
  const [teams, setTeams] = useState([bucketBrigade, glassCleaners] as const);
  const [sendingA, setSendingA] = useState<number[]>([]);
  const [sendingB, setSendingB] = useState<number[]>([]);
  const [teamA, teamB] = teams;

  const analysis = useMemo(() => {
    if (sendingA.length === 0 && sendingB.length === 0) return null;
    return analyzeTrade({
      sideA: { team: teamA, sendingIds: sendingA },
      sideB: { team: teamB, sendingIds: sendingB },
      allTeams: tradeDemoTeams,
      context: tradeDemoContext,
    });
  }, [teamA, teamB, sendingA, sendingB]);

  const reset = useCallback(() => {
    setTeams([bucketBrigade, glassCleaners]);
    setSendingA([]);
    setSendingB([]);
  }, []);

  return (
    <ProductDemo
      url="/trade-analyzer"
      label="Interactive Trade Analyzer demo"
      script={script}
      onReset={reset}
    >
      <DemoBreadcrumb page="Trade Analyzer" />

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Trade Desk</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Build a two-team, players-only trade in{" "}
            <span className="text-foreground font-medium">
              {DEMO_LEAGUE_NAME}
            </span>{" "}
            and see who wins on value and lineup fit.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            className="gap-1.5"
            onClick={() => {
              setTeams([teamB, teamA]);
              setSendingA(sendingB);
              setSendingB(sendingA);
            }}
          >
            <ArrowLeftRightIcon />
            Swap sides
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-1.5"
            disabled={!analysis}
            onClick={() => {
              setSendingA([]);
              setSendingB([]);
            }}
          >
            <RotateCcwIcon />
            Clear
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div data-demo="roster-a">
          <RosterPanel
            heading="Team A sends"
            team={teamA}
            partnerId={teamB.id}
            selectedIds={sendingA}
            onTogglePlayer={(id) => setSendingA((list) => toggle(list, id))}
          />
        </div>
        <div data-demo="roster-b">
          <RosterPanel
            heading="Team B sends"
            team={teamB}
            partnerId={teamA.id}
            selectedIds={sendingB}
            onTogglePlayer={(id) => setSendingB((list) => toggle(list, id))}
          />
        </div>
      </div>

      <div className="mt-4">
        {analysis ? (
          <div className="flex flex-col gap-4">
            <div data-demo="verdict">
              <VerdictBanner analysis={analysis} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div data-demo="impact-a">
                <ImpactCard impact={analysis.sides[0]} />
              </div>
              <div data-demo="impact-b">
                <ImpactCard impact={analysis.sides[1]} />
              </div>
            </div>
          </div>
        ) : (
          <Alert>
            <ArrowLeftRightIcon />
            <AlertTitle>Pick players to trade</AlertTitle>
            <AlertDescription>
              Tap players on either roster to add them to the deal. Analysis
              updates as you build it.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </ProductDemo>
  );
}
