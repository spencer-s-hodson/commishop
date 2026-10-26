"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftRightIcon,
  CheckIcon,
  ChevronDownIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { cn } from "cn";

import { useActiveLeague } from "@/components/active-league-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  analyzeTrade,
  IR_SLOT_ID,
  TRADE_POSITIONS,
  type TradeAnalysis,
  type TradePlayer,
  type TradeTeam,
  type TradeTeamImpact,
} from "@/lib/trade-analysis";
import { api } from "@/trpc/react";

const SNAPSHOT_STALE_MS = 5 * 60 * 1000;
const NO_PLAYERS: number[] = [];

const INJURY_LABELS: Record<string, string> = {
  DAY_TO_DAY: "DTD",
  OUT: "OUT",
  INJURY_RESERVE: "IR",
  QUESTIONABLE: "Q",
  DOUBTFUL: "D",
  SUSPENSION: "SUSP",
};

function injuryLabel(status: string | null) {
  if (!status) return null;
  return INJURY_LABELS[status] ?? status.replaceAll("_", " ");
}

function formatRecord(team: TradeTeam) {
  if (team.ties > 0) return `${team.wins}-${team.losses}-${team.ties}`;
  return `${team.wins}-${team.losses}`;
}

function formatSigned(value: number, digits = 1) {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return (0).toFixed(digits);
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(digits)}`;
}

function ordinal(rank: number) {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[rank % 10] ?? "th";
  return `${rank}${suffix}`;
}

function deltaTone(value: number, epsilon = 0.05) {
  if (value > epsilon) return "text-emerald-700 dark:text-emerald-400";
  if (value < -epsilon) return "text-red-700 dark:text-red-400";
  return "text-muted-foreground";
}

function gradeTone(grade: string) {
  if (grade.startsWith("A")) return "text-emerald-700 dark:text-emerald-400";
  if (grade.startsWith("B")) return "text-foreground";
  if (grade.startsWith("C")) return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}

function TeamLogo({
  team,
  size = "default",
}: {
  team: TradeTeam;
  size?: "default" | "lg";
}) {
  return (
    <Avatar size={size} className="bg-background">
      {team.logoUrl ? (
        <AvatarImage
          src={team.logoUrl}
          alt={team.name}
          className="object-contain p-0.5"
        />
      ) : null}
      <AvatarFallback>{team.abbrev.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

function TeamPicker({
  teams,
  selected,
  excludeId,
  onSelect,
  label,
}: {
  teams: TradeTeam[];
  selected: TradeTeam;
  excludeId: number;
  onSelect: (teamId: number) => void;
  label: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="lg"
            className="w-full justify-between gap-2"
            aria-label={label}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <TeamLogo team={selected} />
          <span className="truncate font-medium">{selected.name}</span>
        </span>
        <ChevronDownIcon className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-64">
        {teams
          .filter((team) => team.id !== excludeId)
          .map((team) => (
            <DropdownMenuItem
              key={team.id}
              onClick={() => onSelect(team.id)}
              className={
                team.id === selected.id ? "bg-accent font-medium" : undefined
              }
            >
              <TeamLogo team={team} />
              <span className="truncate">{team.name}</span>
              <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                {formatRecord(team)}
              </span>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PlayerRow({
  player,
  selected,
  onToggle,
}: {
  player: TradePlayer;
  selected: boolean;
  onToggle: () => void;
}) {
  const injury = injuryLabel(player.injuryStatus);

  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        data-player-id={player.id}
        onClick={onToggle}
        className={cn(
          "hover:bg-muted/60 focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors outline-none focus-visible:ring-[3px]",
          selected && "bg-primary/10 hover:bg-primary/15",
        )}
      >
        <span
          className={cn(
            "border-border flex size-4 shrink-0 items-center justify-center rounded border",
            selected && "border-primary bg-primary text-primary-foreground",
          )}
          aria-hidden
        >
          {selected ? <CheckIcon className="size-3" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{player.name}</span>
            {injury ? (
              <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                {injury}
              </Badge>
            ) : null}
          </span>
          <span className="text-muted-foreground block text-xs">
            {player.positions.join("/") || "—"} · {player.proTeam}
            {player.lineupSlotId === IR_SLOT_ID ? " · IR slot" : ""}
          </span>
        </span>
        <span className="flex w-24 shrink-0 flex-col items-end gap-1 sm:w-28">
          <span className="text-sm font-semibold tabular-nums">
            {player.ppg.toFixed(1)}
            <span className="text-muted-foreground ml-0.5 text-[10px] font-normal">
              FPTS/G
            </span>
          </span>
          <span
            className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
            title={`Trade value ${player.value.toFixed(0)} / 100`}
          >
            <span
              className="bg-primary block h-full rounded-full"
              style={{ width: `${Math.max(2, player.value)}%` }}
            />
          </span>
        </span>
      </button>
    </li>
  );
}

/** Without `onSelectTeam` the team is shown as a fixed label (landing demos). */
export function RosterPanel({
  heading,
  teams,
  team,
  partnerId,
  selectedIds,
  onSelectTeam,
  onTogglePlayer,
}: {
  heading: string;
  teams?: TradeTeam[];
  team: TradeTeam;
  partnerId: number;
  selectedIds: number[];
  onSelectTeam?: (teamId: number) => void;
  onTogglePlayer: (playerId: number) => void;
}) {
  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <CardTitle>{heading}</CardTitle>
          <span className="text-muted-foreground text-xs">
            {team.ownerName ?? team.abbrev} · {formatRecord(team)}
          </span>
        </div>
        {teams && onSelectTeam ? (
          <TeamPicker
            teams={teams}
            selected={team}
            excludeId={partnerId}
            onSelect={onSelectTeam}
            label={`${heading} team`}
          />
        ) : (
          <div className="border-border flex h-9 items-center gap-2 rounded-lg border px-2.5">
            <TeamLogo team={team} />
            <span className="truncate text-sm font-medium">{team.name}</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-muted-foreground mb-1 flex justify-between px-2 text-[11px] font-medium tracking-wide uppercase">
          <span>Player</span>
          <span>Value</span>
        </div>
        <ul className="flex flex-col">
          {team.players.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              selected={selectedIds.includes(player.id)}
              onToggle={() => onTogglePlayer(player.id)}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PlayerList({
  title,
  players,
  emptyLabel,
}: {
  title: string;
  players: TradePlayer[];
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs font-medium">{title}</p>
      {players.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-baseline justify-between gap-2 text-sm"
            >
              <span className="truncate">{player.name}</span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {player.ppg.toFixed(1)} · {player.value.toFixed(0)} val
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: string;
}) {
  return (
    <div className="bg-muted/40 rounded-lg px-3 py-2">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className={cn("text-base font-semibold tabular-nums", tone)}>
        {value}
      </p>
      {detail ? (
        <p className="text-muted-foreground text-xs tabular-nums">{detail}</p>
      ) : null}
    </div>
  );
}

export function ImpactCard({ impact }: { impact: TradeTeamImpact }) {
  const valueNet = impact.valueIn - impact.valueOut;
  const lineupDelta = impact.lineupAfter - impact.lineupBefore;
  const rankDelta = impact.lineupRankBefore - impact.lineupRankAfter;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <TeamLogo team={impact.team} size="lg" />
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate">{impact.team.name}</CardTitle>
            <CardDescription>
              {impact.team.ownerName ?? impact.team.abbrev}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end">
            <span
              className={cn(
                "text-3xl leading-none font-bold tracking-tight",
                gradeTone(impact.grade),
              )}
            >
              {impact.grade}
            </span>
            <span className="text-muted-foreground mt-1 text-[11px]">
              grade
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <PlayerList
            title="Receives"
            players={impact.receives}
            emptyLabel="Nothing"
          />
          <PlayerList
            title="Sends"
            players={impact.sends}
            emptyLabel="Nothing"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          <Metric
            label="Trade value"
            value={formatSigned(valueNet, 0)}
            detail={`${impact.valueIn.toFixed(0)} in · ${impact.valueOut.toFixed(0)} out`}
            tone={deltaTone(valueNet, 0.5)}
          />
          <Metric
            label="Lineup strength"
            value={`${formatSigned(lineupDelta)} FPTS`}
            detail={`${impact.lineupBefore.toFixed(1)} → ${impact.lineupAfter.toFixed(1)} across starters`}
            tone={deltaTone(lineupDelta)}
          />
          <Metric
            label="Lineup rank"
            value={`${ordinal(impact.lineupRankBefore)} → ${ordinal(impact.lineupRankAfter)}`}
            detail={
              rankDelta === 0
                ? "No change"
                : rankDelta > 0
                  ? `Up ${rankDelta}`
                  : `Down ${Math.abs(rankDelta)}`
            }
            tone={deltaTone(rankDelta)}
          />
          <Metric
            label="Rest of season"
            value={`${formatSigned(impact.restOfSeasonDelta, 0)} FPTS`}
            detail="Whole roster, after moves"
            tone={deltaTone(impact.restOfSeasonDelta, 1)}
          />
        </div>

        {impact.drops.length > 0 || impact.pickups.length > 0 ? (
          <div className="text-sm">
            <p className="text-muted-foreground mb-1 text-xs font-medium">
              Roster moves to stay at the limit
            </p>
            <ul className="flex flex-col gap-0.5">
              {impact.drops.map((player) => (
                <li key={`drop-${player.id}`}>
                  <span className="font-medium text-red-700 dark:text-red-400">
                    Drop
                  </span>{" "}
                  {player.name}{" "}
                  <span className="text-muted-foreground text-xs">
                    ({player.ppg.toFixed(1)} FPTS/G)
                  </span>
                </li>
              ))}
              {impact.pickups.map((player) => (
                <li key={`add-${player.id}`}>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    Add
                  </span>{" "}
                  {player.name}{" "}
                  <span className="text-muted-foreground text-xs">
                    (best FA, {player.ppg.toFixed(1)} FPTS/G)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="text-muted-foreground mb-1.5 text-xs font-medium">
            Positional depth (eligible players)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TRADE_POSITIONS.map((position) => {
              const before = impact.depthBefore[position];
              const after = impact.depthAfter[position];
              const thin = impact.thinPositions.includes(position);
              return (
                <Badge
                  key={position}
                  variant={thin ? "destructive" : "outline"}
                  className="tabular-nums"
                  title={
                    thin ? `Thin at ${position} after this trade` : undefined
                  }
                >
                  {position} {before === after ? after : `${before}→${after}`}
                </Badge>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function VerdictBanner({ analysis }: { analysis: TradeAnalysis }) {
  const [a, b] = analysis.sides;
  const { verdict } = analysis;
  const summary =
    verdict.kind === "fair"
      ? "Value and lineup impact land close enough that neither side is getting fleeced."
      : `Grades: ${a.team.name} ${a.grade}, ${b.team.name} ${b.grade}.`;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3",
        verdict.kind === "fair"
          ? "border-emerald-600/30 bg-emerald-500/5"
          : verdict.kind === "lopsided"
            ? "border-red-600/30 bg-red-500/5"
            : "border-border bg-muted/30",
      )}
    >
      <ArrowLeftRightIcon className="text-muted-foreground size-5 shrink-0" />
      <div data-slot="verdict-summary" className="min-w-0">
        <p className="font-semibold">{verdict.headline}</p>
        <p className="text-muted-foreground text-sm">{summary}</p>
      </div>
    </div>
  );
}

export function TradeAnalyzerDashboard() {
  const { activeLeague, activeLeagueId, leaguesLoading } = useActiveLeague();
  // Selections are keyed by league so switching leagues starts fresh.
  const [draft, setDraft] = useState<{
    leagueId: string | null;
    teamAId: number | null;
    teamBId: number | null;
    sendingA: number[];
    sendingB: number[];
  }>({
    leagueId: null,
    teamAId: null,
    teamBId: null,
    sendingA: [],
    sendingB: [],
  });

  const snapshotQuery = api.league.tradeSnapshot.useQuery(
    { leagueId: activeLeagueId! },
    { enabled: Boolean(activeLeagueId), staleTime: SNAPSHOT_STALE_MS },
  );

  const snapshot = snapshotQuery.data;
  const teams = useMemo(() => snapshot?.teams ?? [], [snapshot?.teams]);
  const sameLeague = draft.leagueId === activeLeagueId;

  const teamA =
    teams.find((team) => sameLeague && team.id === draft.teamAId) ??
    teams[0] ??
    null;
  const teamB =
    teams.find(
      (team) =>
        sameLeague && team.id === draft.teamBId && team.id !== teamA?.id,
    ) ??
    teams.find((team) => team.id !== teamA?.id) ??
    null;
  const sendingA = sameLeague ? draft.sendingA : NO_PLAYERS;
  const sendingB = sameLeague ? draft.sendingB : NO_PLAYERS;

  const analysis = useMemo(() => {
    if (!snapshot || !teamA || !teamB) return null;
    if (sendingA.length === 0 && sendingB.length === 0) return null;
    return analyzeTrade({
      sideA: { team: teamA, sendingIds: sendingA },
      sideB: { team: teamB, sendingIds: sendingB },
      allTeams: teams,
      context: snapshot.context,
    });
  }, [snapshot, teams, teamA, teamB, sendingA, sendingB]);

  if (leaguesLoading) return <TradeAnalyzerSkeleton />;

  if (!activeLeagueId || !activeLeague) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No league selected</CardTitle>
          <CardDescription>
            Connect an ESPN league from the sidebar picker to analyze trades.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (snapshotQuery.isLoading) return <TradeAnalyzerSkeleton />;

  if (snapshotQuery.isError || !snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn&apos;t load rosters</CardTitle>
          <CardDescription>
            {snapshotQuery.error?.message ?? "No data returned from ESPN."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (snapshot.categoryLeague) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Points leagues only (for now)</CardTitle>
          <CardDescription>
            The trade analyzer values players by projected fantasy points.
            Category-league support needs per-category valuation and isn&apos;t
            built yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!teamA || !teamB) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Not enough teams</CardTitle>
          <CardDescription>
            A trade needs two teams with rosters.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const update = (patch: Partial<Omit<typeof draft, "leagueId">>) =>
    setDraft({
      leagueId: activeLeagueId,
      teamAId: teamA.id,
      teamBId: teamB.id,
      sendingA,
      sendingB,
      ...patch,
    });

  const toggle = (list: number[], playerId: number) =>
    list.includes(playerId)
      ? list.filter((id) => id !== playerId)
      : [...list, playerId];

  const hasSelection = sendingA.length > 0 || sendingB.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Trade Desk</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Build a two-team, players-only trade in{" "}
            <span className="text-foreground font-medium">
              {snapshot.leagueName}
            </span>{" "}
            and see who wins on value and lineup fit.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            className="gap-1.5"
            onClick={() =>
              update({
                teamAId: teamB.id,
                teamBId: teamA.id,
                sendingA: sendingB,
                sendingB: sendingA,
              })
            }
          >
            <ArrowLeftRightIcon />
            Swap sides
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-1.5"
            disabled={!hasSelection}
            onClick={() => update({ sendingA: [], sendingB: [] })}
          >
            <RotateCcwIcon />
            Clear
          </Button>
        </div>
      </div>

      {analysis ? (
        <div className="flex flex-col gap-4">
          <VerdictBanner analysis={analysis} />
          <div className="grid gap-4 lg:grid-cols-2">
            <ImpactCard impact={analysis.sides[0]} />
            <ImpactCard impact={analysis.sides[1]} />
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

      <div className="grid gap-4 lg:grid-cols-2">
        <RosterPanel
          heading="Team A sends"
          teams={teams}
          team={teamA}
          partnerId={teamB.id}
          selectedIds={sendingA}
          onSelectTeam={(teamId) => update({ teamAId: teamId, sendingA: [] })}
          onTogglePlayer={(playerId) =>
            update({ sendingA: toggle(sendingA, playerId) })
          }
        />
        <RosterPanel
          heading="Team B sends"
          teams={teams}
          team={teamB}
          partnerId={teamA.id}
          selectedIds={sendingB}
          onSelectTeam={(teamId) => update({ teamBId: teamId, sendingB: [] })}
          onTogglePlayer={(playerId) =>
            update({ sendingB: toggle(sendingB, playerId) })
          }
        />
      </div>

      {snapshot.context.freeAgents.length === 0 ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>No free agents found</AlertTitle>
          <AlertDescription>
            Uneven trades can&apos;t backfill open roster spots, so lopsided
            player counts may look worse than they are.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="text-muted-foreground text-xs">
        <p className="text-foreground/80 mb-1.5 font-medium">
          How the analyzer works
        </p>
        <ul className="flex flex-col gap-1">
          <li>
            <span className="text-foreground font-medium">FPTS/G</span> —
            ESPN&apos;s season projection blended with actual production as
            games pile up, nudged by last-15-day form.
          </li>
          <li>
            <span className="text-foreground font-medium">Trade value</span> —
            points per game over replacement level (
            {snapshot.replacementPpg.toFixed(1)} FPTS/G, the best available free
            agents) times expected games left, scaled so stars carry a
            consolidation premium. 100 = the most valuable rostered player.
          </li>
          <li>
            <span className="text-foreground font-medium">Lineup strength</span>{" "}
            — FPTS/G of each team&apos;s best legal starting lineup (
            {snapshot.context.starterSlots.length} slots). Uneven trades
            auto-drop the weakest bench player or add the best free agent to
            stay at {snapshot.context.activeRosterLimit} active players.
          </li>
          <li>
            <span className="text-foreground font-medium">Grade</span> — 60%
            trade value exchanged, 40% lineup impact. Injuries trim expected
            games (OUT, IR, DTD).
          </li>
        </ul>
      </div>
    </div>
  );
}

export function TradeAnalyzerSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, panel) => (
          <div
            key={panel}
            className="border-border/60 flex flex-col gap-3 rounded-xl border p-4"
          >
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
            {Array.from({ length: 8 }).map((_, row) => (
              <div key={row} className="flex items-center gap-3">
                <Skeleton className="size-4 rounded" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
