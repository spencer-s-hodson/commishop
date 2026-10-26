import { PanelLeftIcon } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/** Static stand-in for the dashboard header inside landing demos. */
export function DemoBreadcrumb({ page }: { page: string }) {
  return (
    <div className="-mx-6 -mt-6 flex h-14 items-center gap-3 border-b px-6">
      <PanelLeftIcon className="text-muted-foreground size-4" aria-hidden />
      <span className="bg-border h-4 w-px" aria-hidden />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>Dashboard</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{page}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
