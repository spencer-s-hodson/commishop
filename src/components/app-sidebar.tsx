"use client";

import type * as React from "react";
import { LayoutDashboardIcon, ListOrderedIcon } from "lucide-react";

import { LeaguePicker } from "@/components/league-picker";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

const navMain = [
  {
    title: "Overview",
    url: "/overview",
    icon: <LayoutDashboardIcon />,
  },
  {
    title: "Power Rankings",
    url: "/power-rankings",
    icon: <ListOrderedIcon />,
  },
];

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
};

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <LeaguePicker />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
