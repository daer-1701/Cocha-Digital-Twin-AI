"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useCurrentPathname } from "../../lib/current-pathname";
import { motion, useScroll, useSpring } from "motion/react";
import Lenis from "lenis";

const MAP_ZONE =
  ".map-shell, .map-panel, .map-stage, .observatory-view, .compare-curtain, .study-map, .evidence-drawer, canvas";

const TARGETS = [
  ".page-header",
  ".evidence-heading",
  ".evidence-closing",
  ".evidence-guide",
  ".provenance-panel",
  ".controls",
  ".status",
  ".territory",
  ".panel:not(.map-panel)",
  ".metric-signal",
  ".note",
  ".downloads",
  ".analysis-results > section",
  ".analysis-conclusion",
  ".analysis-figure",
  ".analysis-table",
  ".pilot-slope",
  ".quality-meter",
  ".panel-stack > *",
  ".card-grid > *",
  ".presentation-route",
  ".link-notice",
  ".selection-status",
  ".series-status",
  "main > p",
  "main > .caption",
  "footer",
].join(", ");

const CHILD_TARGETS =
  ".metric-value, .metric-note, .metric-actions, .metric-label, .panel-title, .field, .analysis-value, .downloads a, tbody tr, .section-kicker, .signal-chip, .readout";

const STORAGE_KEY = "cocha-motion";
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

function readMotionPreference() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("motion");
  if (fromUrl === "reduce" || fromUrl === "off") return true;
  if (fromUrl === "on" || fromUrl === "force") return false;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "reduce" || stored === "off") return true;
    if (stored === "on" || stored === "force") return false;
  } catch {
    /* ignore */
  }
  // Demo default: keep pitch motion visible even if the OS asks to reduce motion.
  return false;
}

function subscribeMotionPreference(notify: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", notify);
  window.addEventListener("storage", notify);
  window.addEventListener("popstate", notify);
  return () => {
    query.removeEventListener("change", notify);
    window.removeEventListener("storage", notify);
    window.removeEventListener("popstate", notify);
  };
}

function isSafeTarget(element: Element) {
  if (element.closest(MAP_ZONE)) return false;
  if (element.querySelector(MAP_ZONE)) return false;
  return true;
}

type Variant = "header" | "metric" | "panel" | "note" | "footer" | "default";

function variantFor(element: Element): Variant {
  if (element.matches(".page-header, .evidence-heading, .evidence-closing")) return "header";
  if (element.matches(".metric-signal, .analysis-results > section")) return "metric";
  if (element.matches(".note, .link-notice, .selection-status, .series-status, .status")) return "note";
  if (element.matches("footer")) return "footer";
  if (element.matches(".panel, .controls, .territory, .evidence-guide, .provenance-panel")) {
    return "panel";
  }
  return "default";
}

function framesFor(variant: Variant, index: number): Keyframe[] {
  if (variant === "header") {
    return [
      { opacity: 0, transform: "translateX(-72px) skewX(-3deg)", filter: "blur(10px)" },
      { opacity: 1, transform: "none", filter: "blur(0)" },
    ];
  }
  if (variant === "metric") {
    const left = index % 2 === 0;
    return [
      {
        opacity: 0,
        transform: `translate(${left ? "-64px" : "64px"}, 96px) scale(.88)`,
        filter: "blur(10px)",
      },
      { opacity: 1, transform: "none", filter: "blur(0)" },
    ];
  }
  if (variant === "note") {
    return [
      { opacity: 0, transform: "translateY(40px)", filter: "blur(6px)" },
      { opacity: 1, transform: "none", filter: "blur(0)" },
    ];
  }
  if (variant === "footer") {
    return [
      { opacity: 0, transform: "translateY(48px)" },
      { opacity: 1, transform: "none" },
    ];
  }
  return [
    { opacity: 0, transform: "translateY(88px) scale(.94)", filter: "blur(9px)" },
    { opacity: 1, transform: "none", filter: "blur(0)" },
  ];
}

export function PageMotion() {
  const pathname = useCurrentPathname();
  const reduced = useSyncExternalStore(
    subscribeMotionPreference,
    readMotionPreference,
    () => true,
  );
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 180, damping: 35 });

  useEffect(() => {
    if (reduced) {
      delete document.documentElement.dataset.motion;
      document.documentElement.dataset.motionMode = "reduce";
      return;
    }
    document.documentElement.dataset.motion = "on";
    document.documentElement.dataset.motionMode = "demo";
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        window.localStorage.setItem(STORAGE_KEY, "on");
      }
    } catch {
      /* ignore */
    }
    return () => {
      delete document.documentElement.dataset.motion;
      delete document.documentElement.dataset.motionMode;
    };
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.1,
      smoothWheel: true,
      syncTouch: false,
      prevent: (node) =>
        Boolean(
          node.closest(
            ".cell-options-panel, .map-shell, .compare-curtain, .compare-curtain-stage, .evidence-drawer, .table-wrap, .timeline-dates, nav, select, textarea",
          ),
        ),
    });
    return () => lenis.destroy();
  }, [reduced, pathname]);

  useEffect(() => {
    if (reduced) return;
    document.documentElement.dataset.routeMotion = "enter";
    const clear = window.setTimeout(() => {
      delete document.documentElement.dataset.routeMotion;
    }, 850);
    return () => window.clearTimeout(clear);
  }, [pathname, reduced]);

  useEffect(() => {
    if (reduced) return;
    const root = document.querySelector("main");
    if (!root) return;

    const animations = new Set<Animation>();
    const seen = new WeakSet<Element>();
    const pending = new Map<Element, Animation>();
    const replay = new WeakSet<Element>();
    const order = new WeakMap<Element, number>();
    let wave = 0;
    let ready = false;

    const playChildren = (element: Element, delay: number) => {
      element.querySelectorAll(CHILD_TARGETS).forEach((child, index) => {
        if (!isSafeTarget(child)) return;
        const detail = child.animate(
          [
            { opacity: 0, transform: "translateY(28px)", filter: "blur(6px)" },
            { opacity: 1, transform: "none", filter: "blur(0)" },
          ],
          {
            duration: 700,
            delay: delay + 140 + Math.min(index * 85, 680),
            fill: "both",
            easing: EASE,
          },
        );
        animations.add(detail);
        detail.onfinish = () => {
          detail.cancel();
          animations.delete(detail);
        };
      });
    };

    const arm = (element: Element) => {
      const index = order.get(element) ?? wave++;
      order.set(element, index);
      const variant = variantFor(element);
      const animation = element.animate(framesFor(variant, index), {
        duration: variant === "metric" ? 1050 : 920,
        fill: "both",
        easing: EASE,
      });
      animation.pause();
      animations.add(animation);
      pending.set(element, animation);
      animation.onfinish = () => {
        animation.cancel();
        animations.delete(animation);
      };
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!ready) return;
        let stagger = 0;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        for (const entry of entries) {
          if (entry.isIntersecting) continue;
          const rect = entry.target.getBoundingClientRect();
          const running = [...animations].some((animation) => {
            const target = (animation.effect as KeyframeEffect | null)?.target;
            return animation.playState === "running" && target === entry.target;
          });
          if (
            !running &&
            !pending.has(entry.target) &&
            (rect.bottom < -80 || rect.top > innerHeight + 80) &&
            !entry.target.contains(document.activeElement)
          ) {
            replay.add(entry.target);
          }
        }

        for (const entry of visible) {
          if (!pending.has(entry.target) && replay.has(entry.target)) arm(entry.target);
          replay.delete(entry.target);
          const animation = pending.get(entry.target);
          if (!animation) continue;
          pending.delete(entry.target);
          const delay = Math.min(stagger++ * 120, 480);
          animation.effect?.updateTiming({ delay });
          animation.play();
          playChildren(entry.target, delay);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -4% 0px" },
    );

    const prepare = (element: Element) => {
      if (seen.has(element) || !isSafeTarget(element)) return;
      if (element.parentElement?.closest(TARGETS)) return;
      seen.add(element);
      arm(element);
      observer.observe(element);
    };

    const scan = () => {
      if (!ready) return;
      root.querySelectorAll(TARGETS).forEach(prepare);
      const footer = document.querySelector("footer");
      if (footer) prepare(footer);
    };

    const revealOnFocus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      const host = event.target.closest(TARGETS);
      if (!host) return;
      const animation = pending.get(host);
      if (animation) {
        pending.delete(host);
        animation.finish();
      }
    };

    // Wait until React finished hydrating before touching node styles via WAAPI.
    let cancelled = false;
    let mutations: MutationObserver | null = null;
    const boot = window.setTimeout(() => {
      if (cancelled) return;
      ready = true;
      scan();
      mutations = new MutationObserver(() => scan());
      mutations.observe(root, { childList: true, subtree: true });
      root.addEventListener("focusin", revealOnFocus);
      // Play anything already on screen without waiting for another scroll tick.
      root.querySelectorAll(TARGETS).forEach((element) => {
        if (!pending.has(element)) return;
        const rect = element.getBoundingClientRect();
        if (rect.top < innerHeight * 0.96 && rect.bottom > 24) {
          const animation = pending.get(element);
          if (!animation) return;
          pending.delete(element);
          animation.play();
          playChildren(element, 0);
        }
      });
      const footer = document.querySelector("footer");
      if (footer && pending.has(footer)) {
        const rect = footer.getBoundingClientRect();
        if (rect.top < innerHeight * 0.96 && rect.bottom > 24) {
          const animation = pending.get(footer);
          if (animation) {
            pending.delete(footer);
            animation.play();
          }
        }
      }
    }, 50);

    return () => {
      cancelled = true;
      ready = false;
      window.clearTimeout(boot);
      mutations?.disconnect();
      observer.disconnect();
      root.removeEventListener("focusin", revealOnFocus);
      animations.forEach((animation) => animation.cancel());
      pending.clear();
    };
  }, [pathname, reduced]);

  useEffect(() => {
    if (reduced) return;
    const values = new WeakMap<Element, string>();
    const bump = (element: Element) => {
      element.animate(
        [
          { opacity: 0.2, transform: "translateY(24px) scale(.94)", filter: "blur(6px)" },
          { opacity: 1, transform: "none", filter: "blur(0)" },
        ],
        { duration: 700, easing: EASE },
      );
    };
    const watchValues = () => {
      document.querySelectorAll(".metric-value, .analysis-value").forEach((element) => {
        if (!isSafeTarget(element)) return;
        const next = element.textContent ?? "";
        const prev = values.get(element);
        values.set(element, next);
        if (prev !== undefined && prev !== next) bump(element);
      });
    };
    const onClick = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const control = event.target.closest(
        "main button, main select, main summary, main .downloads a, .presentation-header .nav a",
      );
      if (!control || !isSafeTarget(control) || control.matches(":disabled")) return;
      control.animate(
        [
          { transform: "scale(1)", boxShadow: "0 0 0 0 #9bd6ff90" },
          { transform: "scale(.94)", boxShadow: "0 0 0 8px #9bd6ff40", offset: 0.3 },
          { transform: "scale(1)", boxShadow: "0 0 0 0 #9bd6ff00" },
        ],
        { duration: 650, easing: EASE },
      );
    };
    const main = document.querySelector("main");
    if (!main) return;
    const start = window.setTimeout(() => {
      watchValues();
      mutations.observe(main, { childList: true, subtree: true, characterData: true });
      document.addEventListener("click", onClick);
      document.addEventListener("change", onClick);
    }, 50);
    const mutations = new MutationObserver(watchValues);
    return () => {
      window.clearTimeout(start);
      mutations.disconnect();
      document.removeEventListener("click", onClick);
      document.removeEventListener("change", onClick);
    };
  }, [pathname, reduced]);

  return (
    <motion.div
      aria-hidden="true"
      className="reading-progress"
      style={{ scaleX: reduced ? scrollYProgress : progress }}
    />
  );
}
