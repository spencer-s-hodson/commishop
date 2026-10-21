import Link from "next/link";

import { CommishopLogo } from "@/components/commishop-logo";

type AuthShellProps = {
  children: React.ReactNode;
};

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 text-lg">
            <CommishopLogo size={30} withWordmark />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </div>
      </div>
      <div
        aria-hidden
        className="dark relative hidden overflow-hidden bg-sidebar text-foreground lg:block"
      >
        <div className="bg-court-dots absolute inset-0 mask-[radial-gradient(ellipse_70%_60%_at_85%_20%,black,transparent)]" />
        <div className="absolute inset-x-12 bottom-12">
          <p className="font-heading text-6xl leading-[0.95] font-extrabold tracking-tight xl:text-7xl">
            Run the
            <br />
            league like
            <br />
            <span className="text-brand">a pro.</span>
          </p>
          <p className="mt-6 max-w-sm text-base text-muted-foreground">
            Your fantasy basketball commissioner desk: power rankings,
            matchups, and league intel in one place.
          </p>
        </div>
      </div>
    </div>
  );
}
