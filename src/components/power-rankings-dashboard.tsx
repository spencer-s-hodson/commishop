"use client";

import { useMemo, useRef, useState } from "react";

import { useActiveLeague } from "@/components/active-league-provider";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
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
  buildExportFilename,
  downloadElementAsPdf,
  downloadElementAsPng,
} from "@/lib/export-element";
import {
  ChevronDownIcon,
  DownloadIcon,
  FileImageIcon,
  FileTextIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { api } from "@/trpc/react";

function formatRecord(wins: number, losses: number, ties: number) {
  if (ties > 0) return `${wins}-${losses}-${ties}`;
  return `${wins}-${losses}`;
}

function formatScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Bold fantasy team names in blurbs. Honors model `**name**` markers and also
 * emphasizes any bare matches from the current edition roster.
 */
function BlurbText({
  text,
  teamNames,
}: {
  text: string;
  teamNames: string[];
}) {
  const names = [...new Set(teamNames.filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );

  let working = text.replace(/\*\*/g, "");
  if (names.length > 0) {
    const pattern = new RegExp(`(${names.map(escapeRegExp).join("|")})`, "g");
    working = working.replace(pattern, "**$1**");
  }

  const parts = working.split(/(\*\*[^*]+\*\*)/g).filter((part) => part.length > 0);

  return (
    <>
      {parts.map((part, index) => {
        const match = /^\*\*([^*]+)\*\*$/.exec(part);
        if (match) {
          return (
            <strong key={index} className="font-semibold text-foreground">
              {match[1]}
            </strong>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function formatPublishedAt(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** Positive Δ means climbing vs the previous edition. */
function editionDelta(previousRank: number | null, rank: number) {
  if (previousRank == null) return null;
  return previousRank - rank;
}

function DeltaBadge({
  previousRank,
  rank,
}: {
  previousRank: number | null;
  rank: number;
}) {
  const delta = editionDelta(previousRank, rank);

  if (delta == null) {
    return (
      <span
        className="text-[11px] font-medium tabular-nums text-muted-foreground"
        title="No prior edition"
      >
        —
      </span>
    );
  }

  if (delta === 0) {
    return (
      <span
        className="text-[11px] font-medium tabular-nums text-muted-foreground"
        title="Held steady vs prior edition"
      >
        —
      </span>
    );
  }

  if (delta > 0) {
    return (
      <span
        className="text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
        title={`Up ${delta} from prior edition`}
      >
        ↑{delta}
      </span>
    );
  }

  return (
    <span
      className="text-[11px] font-semibold tabular-nums text-red-700 dark:text-red-400"
      title={`Down ${Math.abs(delta)} from prior edition`}
    >
      ↓{Math.abs(delta)}
    </span>
  );
}

function TeamLogo({
  src,
  alt,
  fallback,
}: {
  src: string | null;
  alt: string;
  fallback: string;
}) {
  return (
    <Avatar size="lg" className="bg-background">
      {src ? (
        <AvatarImage src={src} alt={alt} className="object-contain p-0.5" />
      ) : null}
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}

export function PowerRankingsDashboard() {
  const { activeLeague, activeLeagueId, leaguesLoading } = useActiveLeague();
  const [selectedEditionId, setSelectedEditionId] = useState<string | null>(
    null,
  );
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const editionsQuery = api.league.powerRankings.editions.useQuery(
    { leagueId: activeLeagueId! },
    { enabled: Boolean(activeLeagueId) },
  );

  const resolvedEditionId = useMemo(() => {
    const editions = editionsQuery.data?.editions ?? [];
    if (
      selectedEditionId &&
      editions.some((edition) => edition.id === selectedEditionId)
    ) {
      return selectedEditionId;
    }
    return editionsQuery.data?.latestEditionId ?? undefined;
  }, [
    selectedEditionId,
    editionsQuery.data?.editions,
    editionsQuery.data?.latestEditionId,
  ]);

  const editionQuery = api.league.powerRankings.byEdition.useQuery(
    {
      leagueId: activeLeagueId!,
      editionId: resolvedEditionId,
    },
    { enabled: Boolean(activeLeagueId && resolvedEditionId) },
  );

  if (leaguesLoading) {
    return <PowerRankingsSkeleton />;
  }

  if (!activeLeagueId || !activeLeague) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No league selected</CardTitle>
          <CardDescription>
            Connect an ESPN league from the sidebar picker to see power rankings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (editionsQuery.isLoading) {
    return <PowerRankingsSkeleton />;
  }

  if (editionsQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn&apos;t load power rankings</CardTitle>
          <CardDescription>{editionsQuery.error.message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const editions = editionsQuery.data?.editions ?? [];
  if (editions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No editions yet</CardTitle>
          <CardDescription>
            Preseason rankings will appear once ESPN draft-day projections are
            available for this league.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (editionQuery.isLoading || !editionQuery.data) {
    return <PowerRankingsSkeleton />;
  }

  if (editionQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn&apos;t load this edition</CardTitle>
          <CardDescription>{editionQuery.error.message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { edition, rankings, leagueName } = editionQuery.data;
  const isPreseason = edition.kind === "preseason";
  const isLatest = edition.id === editionsQuery.data?.latestEditionId;

  async function handleExport(format: "png" | "pdf") {
    const node = exportRef.current;
    if (!node || exporting) return;

    setExportError(null);
    setExporting(format);

    try {
      const filename = buildExportFilename(leagueName, edition.label, format);
      if (format === "png") {
        await downloadElementAsPng(node, filename);
      } else {
        await downloadElementAsPdf(node, filename);
      }
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "Export failed. Try again in a moment.",
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Power Rankings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Locked editions for{" "}
            <span className="font-medium text-foreground">{leagueName}</span>
            {" · "}
            published {formatPublishedAt(edition.publishedAt)}
            {isLatest ? " · latest" : ""}
            {" · "}
            {isPreseason
              ? "ESPN draft-day projected roster strength"
              : "locked after matchup end"}
            .
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Edition
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="lg"
                    className="min-w-[10rem] justify-between gap-1.5"
                  />
                }
              >
                <span className="truncate">{edition.label}</span>
                <ChevronDownIcon className="opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {editions.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onClick={() => setSelectedEditionId(item.id)}
                    className={
                      item.id === edition.id ? "bg-accent font-medium" : undefined
                    }
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-col gap-1">
            <span className="invisible text-xs font-medium" aria-hidden>
              Export
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={exporting !== null}
                    className="gap-1.5"
                  />
                }
              >
                <DownloadIcon />
                {exporting === "png"
                  ? "Saving image…"
                  : exporting === "pdf"
                    ? "Saving PDF…"
                    : "Export"}
                <ChevronDownIcon className="opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem
                  disabled={exporting !== null}
                  onClick={() => {
                    void handleExport("png");
                  }}
                >
                  <FileImageIcon />
                  Download PNG
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={exporting !== null}
                  onClick={() => {
                    void handleExport("pdf");
                  }}
                >
                  <FileTextIcon />
                  Download PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {exportError ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Export failed</AlertTitle>
          <AlertDescription>{exportError}</AlertDescription>
        </Alert>
      ) : null}

      {isPreseason ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>How preseason rankings work</AlertTitle>
          <AlertDescription>
            <p>
              Preseason order comes from ESPN&apos;s draft-day projected rank —
              a snapshot of projected roster strength before any matchups are
              played. Power score is just that projection inverted (better
              draft-day rank → higher score).
            </p>
            <p>
              This is unique from every later edition: Match rankings use live
              results (80% dominance + 15% average score + 5% average margin of
              victory) and lock after each matchup period ends. Preseason has
              no win matrix, scores, or MOV yet.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      <div
        ref={exportRef}
        className="rounded-xl bg-background px-1 py-2 sm:px-2"
      >
        <div className="mb-4 border-b border-border/70 pb-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Power Rankings
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {leagueName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {edition.label}
            {" · "}
            published {formatPublishedAt(edition.publishedAt)}
            {isLatest ? " · latest" : ""}
          </p>
        </div>

        <ol className="flex flex-col gap-0">
          {rankings.map((team) => {
            return (
              <li
                key={team.teamId}
                className="border-b border-border/70 py-5 last:border-b-0"
              >
                <div className="flex gap-3 sm:gap-4">
                  <div className="flex w-10 shrink-0 flex-col items-end gap-0.5 pt-0.5 sm:w-12">
                    <span className="text-2xl font-semibold tabular-nums tracking-tight text-muted-foreground sm:text-3xl">
                      {team.rank}
                    </span>
                    <DeltaBadge
                      previousRank={team.previousRank}
                      rank={team.rank}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <TeamLogo
                        src={team.logoUrl}
                        alt={team.name}
                        fallback={team.abbrev.slice(0, 2).toUpperCase()}
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold sm:text-lg">
                          {team.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {team.ownerName ?? team.abbrev}
                          {" · "}
                          {formatRecord(team.wins, team.losses, team.ties)}
                          {" · "}
                          {formatScore(team.pointsFor)} PF
                          {team.previousRank != null ? (
                            <>
                              {" · "}
                              was #{team.previousRank}
                            </>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    {team.blurb ? (
                      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground/90">
                        <BlurbText
                          text={team.blurb}
                          teamNames={rankings.map((row) => row.name)}
                        />
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground italic">
                        Write-up coming soon.
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="text-xs text-muted-foreground">
        <p className="mb-1.5 font-medium text-foreground/80">
          How power rankings work
        </p>
        <ul className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4">
          <li>
            <span className="font-medium text-foreground">Preseason</span> —
            ESPN draft-day projected roster strength
          </li>
          <li>
            <span className="font-medium text-foreground">Match editions</span> —
            80% dominance + 15% avg score + 5% avg MOV, locked after the matchup
            ends
          </li>
          <li>
            <span className="font-medium text-foreground">Δ</span> — vs prior
            edition (↑ climbing)
          </li>
        </ul>
      </div>
    </div>
  );
}

function PowerRankingsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex items-start gap-3 rounded-xl border border-border/60 p-4"
          >
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-full max-w-xl" />
              <Skeleton className="h-3 w-3/4 max-w-lg" />
            </div>
            <Skeleton className="h-5 w-10 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
