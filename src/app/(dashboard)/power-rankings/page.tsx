import { Suspense } from "react";

import { PowerRankingsDashboard } from "@/components/power-rankings-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

function PowerRankingsPageFallback() {
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
            className="border-border/60 flex items-start gap-3 rounded-xl border p-4"
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

export default function PowerRankingsPage() {
  return (
    <Suspense fallback={<PowerRankingsPageFallback />}>
      <PowerRankingsDashboard />
    </Suspense>
  );
}
