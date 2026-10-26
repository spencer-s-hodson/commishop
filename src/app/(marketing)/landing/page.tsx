import type { Metadata } from "next";

import { LandingPage } from "@/components/landing-page";

export const metadata: Metadata = {
  title: "Commishop — Fantasy basketball tools for ESPN leagues",
  description:
    "Connect your ESPN league and get matchup intel, power rankings, and trade analysis built for fantasy basketball.",
};

export default function LandingRoute() {
  return <LandingPage />;
}
