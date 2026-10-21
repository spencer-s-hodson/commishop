import { cn } from "@/lib/utils";

type CommishopLogoProps = {
  className?: string;
  /** Pixel size for the square mark. */
  size?: number;
  /** Show the wordmark beside the mark. */
  withWordmark?: boolean;
};

/**
 * Commishop brand mark: a volt basketball with ink seams on an ink tile.
 * Inline SVG so it stays crisp at any size; mirrors `/brand/commishop-mark.svg`.
 */
export function CommishopLogo({
  className,
  size = 28,
  withWordmark = false,
}: CommishopLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        aria-hidden
        className="shrink-0"
      >
        <rect width="32" height="32" rx="7" fill="#15180F" />
        <circle cx="16" cy="16" r="11" fill="#C2F51C" />
        <g
          fill="none"
          stroke="#15180F"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M16 5v22" />
          <path d="M5 16h22" />
          <path d="M8.2 8.2c3.6 4.2 3.6 11.4 0 15.6" />
          <path d="M23.8 8.2c-3.6 4.2-3.6 11.4 0 15.6" />
        </g>
      </svg>
      {withWordmark ? (
        <span className="font-heading text-[0.95em] font-extrabold tracking-tight uppercase">
          Commishop
        </span>
      ) : null}
      <span className="sr-only">Commishop</span>
    </span>
  );
}
