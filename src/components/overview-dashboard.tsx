"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo } from "react";

import { useActiveLeague } from "@/components/active-league-provider";
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
import { cn } from "cn";
import { ChevronDownIcon } from "lucide-react";
import { api } from "@/trpc/react";

function formatRecord(wins: number, losses: number, ties: number) {
  if (ties > 0) return `${wins}-${losses}-${ties}`;
  return `${wins}-${losses}`;
}

function formatPlayoffPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

function formatGamesBack(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value === 0) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

export function OverviewDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeLeague, activeLeagueId, leaguesLoading } = useActiveLeague();

  const weekFromUrl = searchParams.get("week");
  const selectedWeekParam = useMemo(() => {
    if (!weekFromUrl) return undefined;
    const parsed = Number(weekFromUrl);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }, [weekFromUrl]);

  const overviewQuery = api.league.overview.useQuery(
    {
      leagueId: activeLeagueId!,
      matchupPeriodId: selectedWeekParam,
    },
    { enabled: Boolean(activeLeagueId) },
  );

  useEffect(() => {
    if (!overviewQuery.data || weekFromUrl) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("week", String(overviewQuery.data.currentMatchupPeriod));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [overviewQuery.data, weekFromUrl, pathname, router, searchParams]);

  function selectWeek(matchupPeriodId: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("week", String(matchupPeriodId));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (leaguesLoading) {
    return <OverviewSkeleton />;
  }

  if (!activeLeagueId || !activeLeague) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No league selected</CardTitle>
          <CardDescription>
            Connect an ESPN league from the sidebar picker to see this
            week&apos;s matchups and standings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (overviewQuery.isLoading) {
    return <OverviewSkeleton />;
  }

  if (overviewQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn&apos;t load league data</CardTitle>
          <CardDescription>{overviewQuery.error.message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const overview = overviewQuery.data;
  if (!overview) {
    return <OverviewSkeleton />;
  }

  const selectedOption =
    overview.matchupPeriodOptions.find(
      (option) => option.matchupPeriodId === overview.selectedMatchupPeriod,
    ) ?? null;
  const viewingCurrent =
    overview.selectedMatchupPeriod === overview.currentMatchupPeriod;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <TeamLogo
            src={overview.logoUrl}
            alt={overview.name}
            fallback={overview.name.slice(0, 2).toUpperCase()}
            size="lg"
          />
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {overview.name}
            </h1>
            {viewingCurrent ? (
              <Badge variant="secondary">Current week</Badge>
            ) : overview.selectedMatchupPeriod <
              overview.currentMatchupPeriod ? (
              <Badge variant="outline">Past week</Badge>
            ) : (
              <Badge variant="outline">Upcoming</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">
            Matchup week
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="lg"
                  className="min-w-44 justify-between gap-1.5"
                />
              }
            >
              <span className="truncate">
                {selectedOption?.label ??
                  `Week ${overview.selectedMatchupPeriod}`}
                {viewingCurrent ? " · now" : ""}
              </span>
              <ChevronDownIcon className="opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {overview.matchupPeriodOptions.map((option) => (
                <DropdownMenuItem
                  key={option.matchupPeriodId}
                  onClick={() => selectWeek(option.matchupPeriodId)}
                  className={
                    option.matchupPeriodId === overview.selectedMatchupPeriod
                      ? "bg-accent font-medium"
                      : undefined
                  }
                >
                  {option.label}
                  {option.matchupPeriodId === overview.currentMatchupPeriod
                    ? " · now"
                    : ""}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium">
            {selectedOption?.shortLabel ??
              `Week ${overview.selectedMatchupPeriod}`}{" "}
            matchups
          </h2>
          <p className="text-muted-foreground text-sm">
            {viewingCurrent
              ? "Live scores and projected win odds for the current matchup period."
              : selectedOption?.startDate && selectedOption.endDate
                ? `${selectedOption.startDate} to ${selectedOption.endDate}. Scores and projections for this week.`
                : "Scores and projections for the selected matchup week."}
          </p>
        </div>

        {overviewQuery.isFetching ? (
          <div className="text-muted-foreground text-xs">
            Updating matchups…
          </div>
        ) : null}

        {overview.matchups.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No matchups found</CardTitle>
              <CardDescription>
                ESPN didn&apos;t return matchups for{" "}
                {selectedOption?.shortLabel ??
                  `period ${overview.selectedMatchupPeriod}`}
                .
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {overview.matchups.map((matchup, index) => {
              const isCategoryLeague =
                overview.scoringType?.includes("CATEGORY");
              const homeWinning =
                matchup.away != null && matchup.home.score > matchup.away.score;
              const awayWinning =
                matchup.away != null && matchup.away.score > matchup.home.score;
              const homeProb = matchup.homeWinProbability;
              const awayProb = matchup.awayWinProbability;

              return (
                <Card key={`${matchup.home.teamId}-${index}`}>
                  <CardHeader className="border-b">
                    <CardTitle>Matchup {index + 1}</CardTitle>
                    <CardDescription>
                      Period {matchup.matchupPeriodId}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <MatchupSide
                      abbrev={matchup.home.abbrev}
                      logoUrl={matchup.home.logoUrl}
                      name={matchup.home.name}
                      ownerName={matchup.home.ownerName}
                      score={formatScore(matchup.home.score)}
                      projectedScore={
                        isCategoryLeague ? null : matchup.home.projectedScore
                      }
                      gamesThisWeek={matchup.home.gamesThisWeek}
                      gamesRemaining={matchup.home.gamesRemaining}
                      playersRemaining={matchup.home.playersRemaining}
                      winning={homeWinning}
                    />
                    {matchup.away ? (
                      <>
                        <MatchupSide
                          abbrev={matchup.away.abbrev}
                          logoUrl={matchup.away.logoUrl}
                          name={matchup.away.name}
                          ownerName={matchup.away.ownerName}
                          score={formatScore(matchup.away.score)}
                          projectedScore={
                            isCategoryLeague
                              ? null
                              : matchup.away.projectedScore
                          }
                          gamesThisWeek={matchup.away.gamesThisWeek}
                          gamesRemaining={matchup.away.gamesRemaining}
                          playersRemaining={matchup.away.playersRemaining}
                          winning={awayWinning}
                        />
                        {homeProb != null && awayProb != null ? (
                          <WinProbabilityBars
                            homeAbbrev={matchup.home.abbrev}
                            awayAbbrev={matchup.away.abbrev}
                            homeProbability={homeProb}
                            awayProbability={awayProb}
                          />
                        ) : null}
                      </>
                    ) : (
                      <div className="bg-muted/50 text-muted-foreground rounded-lg px-3 py-2 text-sm">
                        Bye week
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium">Standings</h2>
          <p className="text-muted-foreground text-sm">
            Ranked 1–{overview.standings.length} from ESPN projections
            {overview.scheduleSettings.playoffTeamCount != null
              ? ` · top ${overview.scheduleSettings.playoffTeamCount} make the playoffs`
              : ""}
            .
          </p>
        </div>

        <Card size="sm">
          <CardContent className="overflow-x-auto pt-0">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-muted-foreground border-b">
                <tr>
                  <th className="px-2 py-3 font-medium">#</th>
                  <th className="px-2 py-3 font-medium">Team</th>
                  <th className="px-2 py-3 font-medium">Manager</th>
                  <th className="px-2 py-3 font-medium">Record</th>
                  <th className="px-2 py-3 font-medium">GB</th>
                  <th className="px-2 py-3 font-medium">Streak</th>
                  <th className="px-2 py-3 font-medium">PF</th>
                  <th className="px-2 py-3 font-medium">PA</th>
                  <th className="px-2 py-3 font-medium">Playoff%</th>
                </tr>
              </thead>
              <tbody>
                {overview.standings.map((team) => {
                  const playoffCutoff =
                    overview.scheduleSettings.playoffTeamCount ?? null;
                  const inPlayoffCut =
                    playoffCutoff != null && team.rank <= playoffCutoff;
                  const showCutoffAfter =
                    playoffCutoff != null && team.rank === playoffCutoff;

                  return (
                    <Fragment key={team.teamId}>
                      <tr
                        className={cn(
                          "border-b last:border-0",
                          playoffCutoff != null && !inPlayoffCut
                            ? "opacity-60"
                            : undefined,
                        )}
                      >
                        <td className="text-muted-foreground px-2 py-3 tabular-nums">
                          {team.clinchStatus ? (
                            <span className="text-foreground font-medium">
                              {team.clinchStatus}-
                            </span>
                          ) : null}
                          {team.rank}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2.5">
                            <TeamLogo
                              src={team.logoUrl}
                              alt={team.name}
                              fallback={team.abbrev.slice(0, 2).toUpperCase()}
                            />
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {team.name}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {team.abbrev}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="text-muted-foreground px-2 py-3">
                          {team.ownerName ?? "—"}
                        </td>
                        <td className="px-2 py-3 tabular-nums">
                          {formatRecord(team.wins, team.losses, team.ties)}
                        </td>
                        <td className="px-2 py-3 tabular-nums">
                          {formatGamesBack(team.gamesBack)}
                        </td>
                        <td
                          className={cn(
                            "px-2 py-3 tabular-nums",
                            team.streak?.startsWith("W")
                              ? "text-emerald-700 dark:text-emerald-400"
                              : team.streak?.startsWith("L")
                                ? "text-red-700 dark:text-red-400"
                                : "text-muted-foreground",
                          )}
                        >
                          {team.streak ?? "—"}
                        </td>
                        <td className="px-2 py-3 tabular-nums">
                          {formatScore(team.pointsFor)}
                        </td>
                        <td className="px-2 py-3 tabular-nums">
                          {formatScore(team.pointsAgainst)}
                        </td>
                        <td className="px-2 py-3 tabular-nums">
                          {formatPlayoffPct(team.playoffPct)}
                        </td>
                      </tr>
                      {showCutoffAfter ? (
                        <tr className="border-b">
                          <td
                            colSpan={9}
                            className="bg-muted/40 text-muted-foreground px-2 py-1.5 text-center text-[11px] font-medium tracking-wide uppercase"
                          >
                            Playoff cutoff
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="text-muted-foreground text-xs">
          <p className="text-foreground/80 mb-1.5 font-medium">
            Standings glossary
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            <li>
              <span className="text-foreground font-medium">X</span> — clinched
              playoffs
            </li>
            <li>
              <span className="text-foreground font-medium">Y</span> — clinched
              division
            </li>
            <li>
              <span className="text-foreground font-medium">Z</span> — clinched
              bye
            </li>
            <li>
              <span className="text-foreground font-medium">*</span> — clinched
              No. 1 seed
            </li>
            <li>
              <span className="text-foreground font-medium">E</span> —
              eliminated from playoff contention
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function formatGamesCount(value: number | null | undefined) {
  if (value == null) return null;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatTeamVolume(input: {
  gamesThisWeek: number | null | undefined;
  gamesRemaining: number | null | undefined;
  playersRemaining: number | null | undefined;
}) {
  const parts: string[] = [];
  const weekGames = formatGamesCount(input.gamesThisWeek);
  const left = formatGamesCount(input.gamesRemaining);
  if (weekGames != null) parts.push(`${weekGames} games`);
  if (left != null) parts.push(`${left} left`);
  if (input.playersRemaining != null) {
    parts.push(
      `${input.playersRemaining} player${input.playersRemaining === 1 ? "" : "s"}`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatProbability(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

/** Red (dog) → amber (toss-up) → green (favorite). */
function winProbColor(probability: number) {
  const p = Math.min(1, Math.max(0, probability));
  const hue = p < 0.5 ? 0 + (p / 0.5) * 42 : 42 + ((p - 0.5) / 0.5) * 100;
  return `hsl(${hue} 72% 40%)`;
}

function TeamLogo({
  src,
  alt,
  fallback,
  size = "default",
}: {
  src: string | null;
  alt: string;
  fallback: string;
  size?: "default" | "lg";
}) {
  return (
    <Avatar size={size === "lg" ? "lg" : "default"} className="bg-background">
      {src ? (
        <AvatarImage src={src} alt={alt} className="object-contain p-0.5" />
      ) : null}
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}

function formatProjectedLabel(
  projectedScore: number | null | undefined,
  gamesRemaining: number | null | undefined,
) {
  if (projectedScore == null) return null;
  if ((gamesRemaining ?? 0) <= 0) {
    return projectedScore > 0
      ? `final ${formatScore(projectedScore)}`
      : "no games left";
  }
  return `proj ${formatScore(projectedScore)}`;
}

function MatchupSide({
  abbrev,
  logoUrl,
  name,
  ownerName,
  score,
  projectedScore,
  gamesThisWeek,
  gamesRemaining,
  playersRemaining,
  winning,
}: {
  abbrev: string;
  logoUrl: string | null;
  name: string;
  ownerName: string | null;
  score: string;
  projectedScore: number | null | undefined;
  gamesThisWeek: number | null | undefined;
  gamesRemaining: number | null | undefined;
  playersRemaining: number | null | undefined;
  winning: boolean;
}) {
  const projectedLabel = formatProjectedLabel(projectedScore, gamesRemaining);
  const volumeLabel = formatTeamVolume({
    gamesThisWeek,
    gamesRemaining,
    playersRemaining,
  });

  return (
    <div className="bg-muted/40 flex items-center justify-between gap-3 rounded-lg px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <TeamLogo
          src={logoUrl}
          alt={name}
          fallback={abbrev.slice(0, 2).toUpperCase()}
        />
        <div className="min-w-0">
          <div className="truncate font-medium">{name}</div>
          <div className="text-muted-foreground truncate text-xs">
            {ownerName ?? abbrev}
          </div>
          {volumeLabel ? (
            <div className="text-muted-foreground truncate text-[11px]">
              {volumeLabel}
            </div>
          ) : null}
        </div>
      </div>
      <div className="text-right">
        <div
          className={
            winning
              ? "text-base font-semibold tabular-nums"
              : "text-muted-foreground text-base font-semibold tabular-nums"
          }
        >
          {score}
        </div>
        {projectedLabel ? (
          <div className="text-muted-foreground text-[11px] tabular-nums">
            {projectedLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WinProbabilityBars({
  homeAbbrev,
  awayAbbrev,
  homeProbability,
  awayProbability,
}: {
  homeAbbrev: string;
  awayAbbrev: string;
  homeProbability: number;
  awayProbability: number;
}) {
  return (
    <div className="border-border/60 bg-muted/20 grid gap-2.5 rounded-lg border px-3 py-2.5">
      <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        Win probability
      </div>
      <WinProbabilityRow abbrev={homeAbbrev} probability={homeProbability} />
      <WinProbabilityRow abbrev={awayAbbrev} probability={awayProbability} />
    </div>
  );
}

function WinProbabilityRow({
  abbrev,
  probability,
}: {
  abbrev: string;
  probability: number;
}) {
  const pctWidth = Math.min(100, Math.max(0, probability * 100));
  const color = winProbColor(probability);

  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium">{abbrev}</span>
        <span className="text-sm font-semibold tabular-nums" style={{ color }}>
          {formatProbability(probability)}
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-[width,background-color] duration-300"
          style={{ width: `${pctWidth}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="border-border/60 flex flex-col gap-3 rounded-xl border p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-10" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-10" />
            </div>
          </div>
        ))}
      </div>
      <div className="border-border/60 rounded-xl border p-4">
        <Skeleton className="mb-4 h-5 w-28" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
