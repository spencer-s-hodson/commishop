import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ActiveLeagueProvider } from "@/components/active-league-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ACTIVE_LEAGUE_COOKIE } from "@/lib/active-league";
import { getSession } from "@/server/better-auth/server";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const initialActiveLeagueId =
    cookieStore.get(ACTIVE_LEAGUE_COOKIE)?.value ?? null;

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <ActiveLeagueProvider initialActiveLeagueId={initialActiveLeagueId}>
        <AppSidebar
          user={{
            name: session.user.name,
            email: session.user.email,
            avatar: session.user.image ?? "",
          }}
        />
        <SidebarInset>
          <DashboardHeader />
          <div className="flex flex-1 flex-col gap-4 p-4 pt-4">{children}</div>
        </SidebarInset>
      </ActiveLeagueProvider>
    </SidebarProvider>
  );
}
