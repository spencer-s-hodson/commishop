"use client";

import { useEffect, useRef } from "react";

type LandingRevealProps = {
  children: React.ReactNode;
  className?: string;
};

/** Scroll-into-view reveal. Content stays visible if JS is delayed. */
export function LandingReveal({ children, className }: LandingRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      node.dataset.revealed = "true";
      return;
    }

    node.dataset.ready = "true";

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.dataset.revealed = "true";
            observer.unobserve(node);
          }
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.1 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-landing-reveal className={className}>
      {children}
    </div>
  );
}
