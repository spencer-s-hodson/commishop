import { Suspense } from "react";

import {
  TradeAnalyzerDashboard,
  TradeAnalyzerSkeleton,
} from "@/components/trade-analyzer-dashboard";

export default function TradeAnalyzerPage() {
  return (
    <Suspense fallback={<TradeAnalyzerSkeleton />}>
      <TradeAnalyzerDashboard />
    </Suspense>
  );
}
