"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { setActiveLeagueId } from "@/lib/active-league";
import { api } from "@/trpc/react";

type LeagueListItem = {
  id: string;
  espnLeagueId: number;
  seasonYear: number;
  name: string;
  isPrivate: boolean;
};

type ActiveLeagueContextValue = {
  leagues: LeagueListItem[];
  leaguesLoading: boolean;
  activeLeague: LeagueListItem | null;
  activeLeagueId: string | null;
  setActiveLeague: (leagueId: string) => void;
};

const ActiveLeagueContext = createContext<ActiveLeagueContextValue | null>(
  null,
);

export function ActiveLeagueProvider({
  children,
  initialActiveLeagueId,
}: {
  children: ReactNode;
  initialActiveLeagueId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialActiveLeagueId ?? null,
  );
  const { data: leagues = [], isLoading } = api.league.list.useQuery();

  const activeLeague = useMemo(() => {
    if (leagues.length === 0) return null;
    return (
      leagues.find((league) => league.id === selectedId) ?? leagues[0] ?? null
    );
  }, [leagues, selectedId]);

  const value = useMemo<ActiveLeagueContextValue>(
    () => ({
      leagues,
      leaguesLoading: isLoading,
      activeLeague,
      activeLeagueId: activeLeague?.id ?? null,
      setActiveLeague: (leagueId: string) => {
        setSelectedId(leagueId);
        setActiveLeagueId(leagueId);
      },
    }),
    [leagues, isLoading, activeLeague],
  );

  return (
    <ActiveLeagueContext.Provider value={value}>
      {children}
    </ActiveLeagueContext.Provider>
  );
}

export function useActiveLeague() {
  const context = useContext(ActiveLeagueContext);
  if (!context) {
    throw new Error("useActiveLeague must be used within ActiveLeagueProvider");
  }
  return context;
}
