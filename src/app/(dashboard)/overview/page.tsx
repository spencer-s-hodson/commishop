import { Suspense } from "react";

import { OverviewDashboard } from "@/components/overview-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

function OverviewPageFallback() {
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
            className="flex flex-col gap-3 rounded-xl border border-border/60 p-4"
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
      <div className="rounded-xl border border-border/60 p-4">
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

export default function OverviewPage() {
  return (
    <Suspense fallback={<OverviewPageFallback />}>
      <OverviewDashboard />
    </Suspense>
  );
}
