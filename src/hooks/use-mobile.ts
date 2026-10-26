import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/**
 * SSR-safe mobile detection. During SSR and hydration, always returns `false`
 * so the desktop sidebar markup matches; after hydration it syncs to the
 * real viewport (avoids Sheet vs desktop tree mismatches).
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(MOBILE_QUERY);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}
