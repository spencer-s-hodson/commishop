import Link from "next/link";

import { CommishopLogo } from "@/components/commishop-logo";

type AuthShellProps = {
  children: React.ReactNode;
};

const highlights = [
  "Live matchups & projections",
  "Power rankings by week",
  "Trade analyzer",
] as const;

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative flex flex-col gap-4 p-6 md:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_0%_0%,oklch(from_var(--brand)_l_c_h_/_0.12),transparent_55%)]"
        />
        <div className="relative flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 text-lg">
            <CommishopLogo size={30} withWordmark />
          </Link>
        </div>
        <div className="relative flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      <div
        aria-hidden
        className="dark bg-sidebar text-foreground relative hidden overflow-hidden lg:block"
      >
        <div className="bg-court-dots absolute inset-0 opacity-70 mask-[radial-gradient(ellipse_75%_65%_at_90%_10%,black,transparent)]" />
        <div className="absolute -top-24 -right-24 size-[28rem] rounded-full bg-[oklch(from_var(--brand)_l_c_h_/_0.18)] blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-[22rem] rounded-full bg-[oklch(from_var(--brand)_l_c_h_/_0.1)] blur-3xl" />

        <div className="absolute inset-x-12 bottom-12">
          <p className="font-heading text-5xl leading-[0.95] font-extrabold tracking-tight xl:text-6xl">
            Win more
            <br />
            matchups.
            <br />
            <span className="text-brand">Smarter tools.</span>
          </p>
          <p className="text-muted-foreground mt-6 max-w-md text-base leading-relaxed">
            Connect your ESPN league and get matchup intel, power rankings, and
            trade analysis built for fantasy basketball.
          </p>
          <ul className="mt-8 flex flex-col gap-2.5">
            {highlights.map((item) => (
              <li
                key={item}
                className="text-sidebar-foreground/85 flex items-center gap-2.5 text-sm"
              >
                <span className="bg-brand size-1.5 shrink-0 rounded-full" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
