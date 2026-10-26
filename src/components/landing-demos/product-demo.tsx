"use client";

import { MousePointerClickIcon, RotateCcwIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

/** Logical page width the demo content is laid out at, then scaled to fit. */
const STAGE_WIDTH = 1040;
const CAMERA_MS = 1100;
const CURSOR_MS = 750;
const CAMERA_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
const FOLLOW_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const RESUME_AFTER_HOVER_MS = 2400;
const RESUME_AFTER_TOUCH_MS = 7000;
/** Pointer travel (px) before a hover counts as exploring, not a scroll-by. */
const EXPLORE_THRESHOLD_PX = 10;
const MAX_ZOOM = 2.6;
/** Scripted shots never show text smaller than this share of its real size. */
const MIN_SCREEN_ZOOM = 0.8;

type Camera =
  { kind: "fit" } | { kind: "focus"; x: number; y: number; zoom: number };

const FIT: Camera = { kind: "fit" };

/** What a demo script can do. Every step rejects once the run is aborted. */
export type DemoDirector = {
  caption: (text: string | null) => void;
  /** Zoom out until the whole page fits. */
  fit: () => Promise<void>;
  /**
   * Frame an element; zoom defaults to filling the frame. `align: "start"`
   * pins its left edge instead of centering, for rows wider than the view.
   */
  focus: (
    selector: string,
    options?: { zoom?: number; dwell?: number; align?: "center" | "start" },
  ) => Promise<void>;
  /** Glide the cursor onto an element. */
  point: (selector: string) => Promise<void>;
  /** Point, press, and fire a real click on an element. */
  click: (selector: string) => Promise<void>;
  wait: (ms: number) => Promise<void>;
};

export type DemoScript = (director: DemoDirector) => Promise<void>;

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason as Error);
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(signal.reason as Error);
      },
      { once: true },
    );
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Layout box of `el` in `root` coordinates; unaffected by CSS transforms. */
function boxWithin(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, width: el.offsetWidth, height: el.offsetHeight };
}

function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export function usePrefersReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

export function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView] as const;
}

type Metrics = {
  /** Screen px per logical px for the whole stage. */
  scale: number;
  viewportHeight: number;
  contentHeight: number;
};

function fitZoom(metrics: Metrics) {
  if (metrics.contentHeight <= 0) return 1;
  return Math.min(1, metrics.viewportHeight / metrics.contentHeight);
}

function resolveCamera(camera: Camera, metrics: Metrics) {
  const minZoom = fitZoom(metrics);
  const zoom =
    camera.kind === "fit" ? minZoom : clamp(camera.zoom, minZoom, MAX_ZOOM);
  const centerX = camera.kind === "fit" ? STAGE_WIDTH / 2 : camera.x;
  const centerY = camera.kind === "fit" ? 0 : camera.y;

  // Keep the page edge-to-edge when it overflows; center it when it doesn't.
  const offset = (center: number, view: number, size: number) => {
    const scaled = size * zoom;
    if (scaled <= view) return (view - scaled) / 2;
    return clamp(view / 2 - center * zoom, view - scaled, 0);
  };

  return {
    zoom,
    x: offset(centerX, STAGE_WIDTH, STAGE_WIDTH),
    y: offset(centerY, metrics.viewportHeight, metrics.contentHeight),
  };
}

type CursorState = { x: number; y: number; visible: boolean; presses: number };

export function ProductDemo({
  url,
  label,
  script,
  onReset,
  children,
  className,
}: {
  /** Path shown in the faux address bar. */
  url: string;
  /** Accessible name for the demo region. */
  label: string;
  script: DemoScript;
  /** Put the demo back in its starting state before each autoplay loop. */
  onReset: () => void;
  children: ReactNode;
  className?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [frameRef, inView] = useInView<HTMLElement>();
  const reducedMotion = usePrefersReducedMotion();
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)", true);

  const [metrics, setMetrics] = useState<Metrics>({
    scale: 0,
    viewportHeight: 0,
    contentHeight: 0,
  });
  const metricsRef = useRef(metrics);

  const [camera, setCamera] = useState<Camera>(FIT);
  const cameraRef = useRef<Camera>(FIT);
  const moveCamera = useCallback((next: Camera) => {
    cameraRef.current = next;
    setCamera(next);
  }, []);
  const [cursor, setCursor] = useState<CursorState>({
    x: STAGE_WIDTH / 2,
    y: 160,
    visible: false,
    presses: 0,
  });
  const [caption, setCaption] = useState<string | null>(null);
  const [mode, setMode] = useState<"auto" | "explore">("auto");
  const [runKey, setRunKey] = useState(0);

  const resetDemo = useEffectEvent(() => onReset());
  const runScript = useEffectEvent((director: DemoDirector) =>
    script(director),
  );

  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTravel = useRef(0);
  const followFrame = useRef<number | null>(null);

  // Track the frame's screen size and the page's natural height.
  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const measure = () => {
      const scale = viewport.clientWidth / STAGE_WIDTH;
      if (scale <= 0) return;
      const next = {
        scale,
        viewportHeight: viewport.clientHeight / scale,
        contentHeight: content.offsetHeight,
      };
      metricsRef.current = next;
      setMetrics(next);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    measure();
    return () => observer.disconnect();
  }, []);

  const ready = metrics.scale > 0 && metrics.contentHeight > 0;

  const findTarget = useCallback((selector: string) => {
    const element = contentRef.current?.querySelector<HTMLElement>(selector);
    if (!element) console.warn(`[ProductDemo] no element for ${selector}`);
    return element ?? null;
  }, []);

  const cameraOn = useCallback(
    (
      element: HTMLElement,
      zoom?: number,
      align: "center" | "start" = "center",
    ) => {
      const content = contentRef.current;
      if (!content) return FIT;
      const box = boxWithin(element, content);
      const { viewportHeight, scale } = metricsRef.current;
      const autoZoom = Math.min(
        (STAGE_WIDTH * 0.84) / box.width,
        (viewportHeight * 0.8) / box.height,
      );
      // Small frames (phones) need a tighter shot to stay readable.
      const nextZoom = Math.min(
        MAX_ZOOM,
        Math.max(zoom ?? autoZoom, MIN_SCREEN_ZOOM / scale),
      );
      return {
        kind: "focus",
        x:
          align === "start"
            ? box.x - 24 + STAGE_WIDTH / (2 * nextZoom)
            : box.x + box.width / 2,
        y: box.y + box.height / 2,
        zoom: nextZoom,
      } satisfies Camera;
    },
    [],
  );

  // Autoplay loop. Restarts from a clean slate whenever it is (re)entered.
  useEffect(() => {
    if (!ready || mode !== "auto") return;
    if (!inView && !reducedMotion) return;

    const controller = new AbortController();
    const { signal } = controller;
    const instant = reducedMotion;
    const pause = (ms: number) => sleep(instant ? 40 : ms, signal);

    const director: DemoDirector = {
      caption: (text) => {
        if (!signal.aborted) setCaption(text);
      },
      fit: async () => {
        if (!instant) moveCamera(FIT);
        await pause(CAMERA_MS);
      },
      focus: async (selector, options) => {
        const element = findTarget(selector);
        if (element && !instant) {
          moveCamera(cameraOn(element, options?.zoom, options?.align));
        }
        await pause(CAMERA_MS + (options?.dwell ?? 0));
      },
      point: async (selector) => {
        const element = findTarget(selector);
        const content = contentRef.current;
        if (!element || !content || instant) return;
        const box = boxWithin(element, content);
        const x = box.x + Math.min(box.width / 2, 72);
        const y = box.y + box.height * 0.6;

        // Pan first if the target is outside (or hugging the edge of) the shot.
        const view = resolveCamera(cameraRef.current, metricsRef.current);
        const left = -view.x / view.zoom;
        const top = -view.y / view.zoom;
        const width = STAGE_WIDTH / view.zoom;
        const height = metricsRef.current.viewportHeight / view.zoom;
        const inShot =
          x > left + width * 0.1 &&
          x < left + width * 0.9 &&
          y > top + height * 0.1 &&
          y < top + height * 0.82;
        if (!inShot) {
          moveCamera({ kind: "focus", x, y, zoom: view.zoom });
          await pause(CAMERA_MS * 0.7);
        }

        setCursor((current) => ({ ...current, x, y, visible: true }));
        await pause(CURSOR_MS);
      },
      click: async (selector) => {
        await director.point(selector);
        if (!instant) {
          setCursor((current) => ({
            ...current,
            presses: current.presses + 1,
          }));
          await pause(150);
        }
        findTarget(selector)?.click();
        await pause(450);
      },
      wait: pause,
    };

    const run = async () => {
      do {
        resetDemo();
        moveCamera(FIT);
        setCaption(null);
        setCursor((current) => ({ ...current, visible: false }));
        await pause(700);
        await runScript(director);
        if (instant) return;
        await pause(2600);
      } while (!signal.aborted);
    };

    run().catch((error: unknown) => {
      if (!signal.aborted) throw error;
    });
    return () => controller.abort();
  }, [
    ready,
    mode,
    inView,
    reducedMotion,
    runKey,
    findTarget,
    cameraOn,
    moveCamera,
  ]);

  const clearResume = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = null;
  };

  const scheduleResume = (ms: number) => {
    clearResume();
    resumeTimer.current = setTimeout(() => {
      hoverTravel.current = 0;
      setMode("auto");
    }, ms);
  };

  useEffect(
    () => () => {
      clearResume();
      if (followFrame.current) cancelAnimationFrame(followFrame.current);
    },
    [],
  );

  const explore = () => {
    clearResume();
    if (mode === "explore") return;
    setMode("explore");
    setCaption(null);
    setCursor((current) => ({ ...current, visible: false }));
  };

  /** Hovering pans the page under the pointer, like a loupe. */
  const followPointer = (clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const edge = (fraction: number) => clamp((fraction - 0.12) / 0.76, 0, 1);
    const fx = edge((clientX - rect.left) / rect.width);
    const fy = edge((clientY - rect.top) / rect.height);
    const { scale, contentHeight } = metrics;

    if (followFrame.current) cancelAnimationFrame(followFrame.current);
    followFrame.current = requestAnimationFrame(() => {
      moveCamera({
        kind: "focus",
        x: fx * STAGE_WIDTH,
        y: fy * contentHeight,
        zoom: clamp(1 / scale, 1.15, 1.8),
      });
    });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    if (mode === "auto") {
      hoverTravel.current +=
        Math.abs(event.movementX) + Math.abs(event.movementY);
      if (hoverTravel.current < EXPLORE_THRESHOLD_PX) return;
      explore();
    }
    if (!reducedMotion) followPointer(event.clientX, event.clientY);
  };

  const onPointerLeave = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    hoverTravel.current = 0;
    if (mode !== "explore") return;
    moveCamera(FIT);
    scheduleResume(RESUME_AFTER_HOVER_MS);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse") return;
    explore();
    scheduleResume(RESUME_AFTER_TOUCH_MS);
  };

  const onFocus = (event: React.FocusEvent) => {
    const target = event.target as HTMLElement;
    if (!target.matches(":focus-visible")) return;
    explore();
    if (!reducedMotion) moveCamera(cameraOn(target, 1.6));
  };

  const onBlur = (event: React.FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (next && viewportRef.current?.contains(next)) return;
    if (mode === "explore") scheduleResume(RESUME_AFTER_HOVER_MS);
  };

  const replay = () => {
    clearResume();
    hoverTravel.current = 0;
    setMode("auto");
    setRunKey((key) => key + 1);
  };

  const view = resolveCamera(camera, metrics);
  const following = mode === "explore";
  const cameraTransition = reducedMotion
    ? "none"
    : following
      ? `transform 600ms ${FOLLOW_EASE}`
      : `transform ${CAMERA_MS}ms ${CAMERA_EASE}`;
  // Keep the cursor the same size on screen regardless of camera zoom.
  const cursorScale = metrics.scale > 0 ? 1 / (metrics.scale * view.zoom) : 1;

  const hint =
    mode === "explore"
      ? canHover
        ? "Exploring · click anything"
        : "Your turn · tap anything"
      : canHover
        ? "Hover to explore"
        : "Tap to try it";

  return (
    <figure
      ref={frameRef}
      role="region"
      aria-label={label}
      className={cn(
        "bg-card ring-foreground/10 overflow-hidden rounded-2xl shadow-[0_28px_70px_-36px_oklch(0.17_0.012_125_/_0.55)] ring-1",
        className,
      )}
    >
      <div className="bg-muted/60 flex h-10 items-center gap-3 border-b px-3 sm:px-4">
        <div className="flex shrink-0 gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="bg-background text-muted-foreground mx-auto flex h-6 max-w-sm min-w-0 flex-1 items-center justify-center truncate rounded-md px-3 text-xs">
          commishop.app{url}
        </div>
        <button
          type="button"
          onClick={replay}
          className="text-muted-foreground hover:text-foreground hover:bg-background focus-visible:ring-ring/50 flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px]"
        >
          <RotateCcwIcon className="size-3.5" />
          <span className="hidden sm:inline">Replay</span>
        </button>
      </div>

      <div
        ref={viewportRef}
        className="bg-muted/40 relative aspect-[4/5] overflow-hidden sm:aspect-[16/10]"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <div
          className={cn(
            "absolute top-0 left-0 origin-top-left transition-opacity duration-500",
            ready ? "opacity-100" : "opacity-0",
          )}
          style={{
            width: STAGE_WIDTH,
            transform: `scale(${metrics.scale || 1})`,
          }}
        >
          <div
            ref={contentRef}
            className="bg-background relative origin-top-left p-6"
            style={{
              width: STAGE_WIDTH,
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
              transition: ready ? cameraTransition : "none",
            }}
          >
            {children}

            <div
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 z-50 origin-top-left"
              style={{
                transform: `translate(${cursor.x}px, ${cursor.y}px) scale(${cursorScale})`,
                opacity: cursor.visible && mode === "auto" ? 1 : 0,
                transition: reducedMotion
                  ? "none"
                  : `transform ${CURSOR_MS}ms ${CAMERA_EASE}, opacity 250ms ease`,
              }}
            >
              {cursor.presses > 0 ? (
                <span
                  key={cursor.presses}
                  className="demo-click-ripple bg-brand/40 absolute -top-5 -left-5 size-10 rounded-full"
                />
              ) : null}
              <svg
                width="22"
                height="26"
                viewBox="0 0 22 26"
                className="relative drop-shadow-[0_2px_3px_rgb(0_0_0/0.35)]"
              >
                <path
                  d="M1.5 1.5v20.2l5.3-5.1 3.4 7.9 3.6-1.5-3.3-7.8h7.4z"
                  fill="black"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 sm:inset-x-4 sm:bottom-4">
          <p
            aria-live="polite"
            className={cn(
              "bg-foreground/85 text-background max-w-[70%] rounded-full px-3.5 py-1.5 text-xs font-medium shadow-lg backdrop-blur transition-all duration-300 sm:text-sm",
              caption && mode === "auto"
                ? "translate-y-0 opacity-100"
                : "translate-y-1 opacity-0",
            )}
          >
            {caption}
          </p>
          <span className="bg-background/85 text-muted-foreground ring-foreground/10 flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm ring-1 backdrop-blur">
            <MousePointerClickIcon className="size-3.5" />
            {hint}
          </span>
        </div>
      </div>
    </figure>
  );
}
