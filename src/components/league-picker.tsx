"use client";

import { useState } from "react";
import { ChevronsUpDownIcon, PlusIcon } from "lucide-react";

import { useActiveLeague } from "@/components/active-league-provider";
import { CommishopLogo } from "@/components/commishop-logo";
import { ConnectLeagueDialog } from "@/components/connect-league-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function LeaguePicker() {
  const { isMobile } = useSidebar();
  const [connectOpen, setConnectOpen] = useState(false);
  const { leagues, leaguesLoading, activeLeague, setActiveLeague } =
    useActiveLeague();

  if (leaguesLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled className="pointer-events-none">
            <Skeleton className="size-8 shrink-0 rounded-lg" />
            <div className="grid flex-1 gap-1.5 text-left">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                />
              }
            >
              <CommishopLogo size={32} />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeLeague?.name ?? "Select a league"}
                </span>
                <span className="truncate text-xs">
                  {activeLeague
                    ? `${activeLeague.seasonYear}${activeLeague.isPrivate ? " · Private" : " · Public"}`
                    : "Connect an ESPN league"}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-72"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  Your leagues
                </DropdownMenuLabel>
                {leagues.length === 0 ? (
                  <DropdownMenuItem disabled>
                    No leagues connected yet
                  </DropdownMenuItem>
                ) : (
                  leagues.map((league) => (
                    <DropdownMenuItem
                      key={league.id}
                      onClick={() => {
                        setActiveLeague(league.id);
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{league.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {league.seasonYear}
                          {league.isPrivate ? " · Private" : " · Public"}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => {
                    setConnectOpen(true);
                  }}
                >
                  <PlusIcon />
                  Connect a league
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <ConnectLeagueDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={setActiveLeague}
      />
    </>
  );
}
