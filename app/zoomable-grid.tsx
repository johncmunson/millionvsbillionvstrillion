"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, WheelEvent } from "react";
import { MIN_VISUALIZED_NET_WORTH } from "./net-worth";
import styles from "./home.module.css";

const GRID_SIZE = 1000;
const GRID_CENTER = GRID_SIZE / 2;
const MILLION_CELL_SIZE = 1;
const GRID_LINE_EPSILON = 0.000001;
const BILLION_SIZE = Math.sqrt(1_000);
const BILLION_WIDTH = BILLION_SIZE;
const BILLION_HEIGHT = BILLION_SIZE;
const BILLION_X = (GRID_SIZE - BILLION_WIDTH) / 2;
const BILLION_Y = (GRID_SIZE - BILLION_HEIGHT) / 2;
const MILLION_X = (GRID_SIZE - MILLION_CELL_SIZE) / 2;
const MILLION_Y = (GRID_SIZE - MILLION_CELL_SIZE) / 2;
const RED_VALUE = 190_000;
const RED_SIZE = Math.sqrt(RED_VALUE / 1_000_000);
const RED_X = MILLION_X + (1 - RED_SIZE) / 2;
const RED_Y = MILLION_Y + (1 - RED_SIZE) / 2;
const GRID_LINES_VISIBLE_ZOOM = 5;
const RED_VISIBLE_ZOOM = 18;
const RED_TEXT_VISIBLE_ZOOM = 70;
const MIN_ZOOM = 1;
const MAX_ZOOM = 1200;
const ZOOM_STEP = 1.8;
const ZOOM_EPSILON = 0.001;
const SCALE_KEY_ZOOM_TARGET_ATTRIBUTE = "data-grid-zoom-target";
const SCALE_KEY_ZOOM_DURATION_MS = 1800;
const NET_WORTH_ZOOM_DURATION_MS = 2800;

const INITIAL_VIEW = {
  zoom: MIN_ZOOM,
  centerX: GRID_CENTER,
  centerY: GRID_CENTER,
};

type View = typeof INITIAL_VIEW;

type ZoomableGridProps = {
  highlightedNetWorth: number | null;
};

type VisibleArea = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeView(view: View): View {
  return {
    zoom: clamp(view.zoom, MIN_ZOOM, MAX_ZOOM),
    centerX: GRID_CENTER,
    centerY: GRID_CENTER,
  };
}

function getBrowserScale() {
  if (typeof window === "undefined") {
    return 1;
  }

  return (window.devicePixelRatio || 1) * (window.visualViewport?.scale || 1);
}

function getPrefersReducedMotion() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function formatZoom(zoom: number) {
  if (zoom >= 100) {
    return Math.round(zoom).toLocaleString();
  }

  if (zoom >= 10) {
    return zoom.toFixed(0);
  }

  return zoom.toFixed(1).replace(".0", "");
}

function getMillionGridPath({ left, top, right, bottom }: VisibleArea) {
  const segments: string[] = [];
  const firstX =
    MILLION_X +
    Math.ceil((left - MILLION_X - GRID_LINE_EPSILON) / MILLION_CELL_SIZE) *
      MILLION_CELL_SIZE;
  const lastX =
    MILLION_X +
    Math.floor((right - MILLION_X + GRID_LINE_EPSILON) / MILLION_CELL_SIZE) *
      MILLION_CELL_SIZE;
  const firstY =
    MILLION_Y +
    Math.ceil((top - MILLION_Y - GRID_LINE_EPSILON) / MILLION_CELL_SIZE) *
      MILLION_CELL_SIZE;
  const lastY =
    MILLION_Y +
    Math.floor((bottom - MILLION_Y + GRID_LINE_EPSILON) / MILLION_CELL_SIZE) *
      MILLION_CELL_SIZE;

  for (let x = firstX; x <= lastX + GRID_LINE_EPSILON; x += MILLION_CELL_SIZE) {
    segments.push(`M${x} ${top}V${bottom}`);
  }

  for (let y = firstY; y <= lastY + GRID_LINE_EPSILON; y += MILLION_CELL_SIZE) {
    segments.push(`M${left} ${y}H${right}`);
  }

  return segments.join("");
}

export default function ZoomableGrid({
  highlightedNetWorth,
}: ZoomableGridProps) {
  const lastBrowserScaleRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastHighlightedNetWorthRef = useRef<number | null>(null);
  const viewRef = useRef<View>(INITIAL_VIEW);
  const [view, setView] = useState<View>(INITIAL_VIEW);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const visibleArea = useMemo(() => {
    const span = GRID_SIZE / view.zoom;
    const left = view.centerX - span / 2;
    const top = view.centerY - span / 2;

    return {
      span,
      left,
      top,
      right: left + span,
      bottom: top + span,
      viewBox: `${left} ${top} ${span} ${span}`,
    };
  }, [view]);

  const showMillionGrid = view.zoom >= GRID_LINES_VISIBLE_ZOOM;

  const highlightedBox = useMemo(() => {
    if (
      highlightedNetWorth === null ||
      highlightedNetWorth < MIN_VISUALIZED_NET_WORTH
    ) {
      return null;
    }

    const rawSize = Math.sqrt(highlightedNetWorth / 1_000_000);
    const size = clamp(rawSize, MILLION_CELL_SIZE, GRID_SIZE);

    return {
      x: GRID_CENTER - size / 2,
      y: GRID_CENTER - size / 2,
      size,
      targetZoom: clamp(645 / rawSize, MIN_ZOOM, MAX_ZOOM),
    };
  }, [highlightedNetWorth]);

  const millionGridPath = useMemo(
    () => (showMillionGrid ? getMillionGridPath(visibleArea) : ""),
    [showMillionGrid, visibleArea],
  );

  const redCellLabelStyle = useMemo<CSSProperties>(() => {
    const { span, left, top } = visibleArea;

    return {
      left: `${((RED_X - left) / span) * 100}%`,
      top: `${((RED_Y - top) / span) * 100}%`,
      width: `${(RED_SIZE / span) * 100}%`,
      height: `${(RED_SIZE / span) * 100}%`,
    };
  }, [visibleArea]);

  const getZoomedView = useCallback((current: View, nextZoom: number) => {
    return normalizeView({ ...current, zoom: nextZoom });
  }, []);

  const cancelZoomAnimation = useCallback(() => {
    if (animationFrameRef.current === null) {
      return;
    }

    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      cancelZoomAnimation();

      setView((current) => {
        const nextView = getZoomedView(current, current.zoom * factor);
        viewRef.current = nextView;
        return nextView;
      });
    },
    [cancelZoomAnimation, getZoomedView],
  );

  const animateZoomTo = useCallback(
    (targetZoom: number, duration = SCALE_KEY_ZOOM_DURATION_MS) => {
      const currentView = viewRef.current;
      const targetView = getZoomedView(currentView, targetZoom);
      const target = targetView.zoom;

      cancelZoomAnimation();

      if (
        getPrefersReducedMotion() ||
        Math.abs(currentView.zoom - target) < ZOOM_EPSILON
      ) {
        viewRef.current = targetView;
        setView(targetView);
        return;
      }

      const startTime = performance.now();
      const startZoom = currentView.zoom;
      const zoomRatio = target / startZoom;

      const tick = (now: number) => {
        const progress = clamp(
          (now - startTime) / duration,
          0,
          1,
        );
        const easedProgress = easeInOutCubic(progress);
        const nextZoom =
          progress >= 1
            ? target
            : startZoom * Math.pow(zoomRatio, easedProgress);
        const nextView = getZoomedView(currentView, nextZoom);

        viewRef.current = nextView;
        setView(nextView);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(tick);
          return;
        }

        animationFrameRef.current = null;
      };

      animationFrameRef.current = requestAnimationFrame(tick);
    },
    [cancelZoomAnimation, getZoomedView],
  );

  useEffect(() => {
    if (highlightedNetWorth === null || highlightedBox === null) {
      if (lastHighlightedNetWorthRef.current !== null) {
        animateZoomTo(MIN_ZOOM, NET_WORTH_ZOOM_DURATION_MS);
      }

      lastHighlightedNetWorthRef.current = null;
      return;
    }

    if (lastHighlightedNetWorthRef.current === highlightedNetWorth) {
      return;
    }

    lastHighlightedNetWorthRef.current = highlightedNetWorth;
    animateZoomTo(highlightedBox.targetZoom, NET_WORTH_ZOOM_DURATION_MS);
  }, [animateZoomTo, highlightedBox, highlightedNetWorth]);

  useEffect(() => {
    const handleScaleKeyClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const trigger = event.target.closest(
        `[${SCALE_KEY_ZOOM_TARGET_ATTRIBUTE}]`,
      );

      if (!(trigger instanceof HTMLElement)) {
        return;
      }

      const targetZoom = Number(trigger.dataset.gridZoomTarget);

      if (!Number.isFinite(targetZoom)) {
        return;
      }

      animateZoomTo(targetZoom);
    };

    document.addEventListener("click", handleScaleKeyClick);

    return () => {
      document.removeEventListener("click", handleScaleKeyClick);
    };
  }, [animateZoomTo]);

  useEffect(() => {
    return () => {
      cancelZoomAnimation();
    };
  }, [cancelZoomAnimation]);

  useEffect(() => {
    lastBrowserScaleRef.current = getBrowserScale();

    const handleBrowserZoomChange = () => {
      const previousScale = lastBrowserScaleRef.current ?? getBrowserScale();
      const nextScale = getBrowserScale();
      const factor = nextScale / previousScale;

      if (!Number.isFinite(factor) || Math.abs(factor - 1) < 0.01) {
        return;
      }

      setView((current) => {
        const nextView = getZoomedView(current, current.zoom * factor);
        const appliedFactor = nextView.zoom / current.zoom;

        if (
          !Number.isFinite(appliedFactor) ||
          Math.abs(appliedFactor - 1) < 0.01
        ) {
          return current;
        }

        lastBrowserScaleRef.current = previousScale * appliedFactor;
        viewRef.current = nextView;
        return nextView;
      });
    };

    window.addEventListener("resize", handleBrowserZoomChange);
    window.visualViewport?.addEventListener("resize", handleBrowserZoomChange);

    return () => {
      window.removeEventListener("resize", handleBrowserZoomChange);
      window.visualViewport?.removeEventListener(
        "resize",
        handleBrowserZoomChange,
      );
    };
  }, [getZoomedView]);

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
  };

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    switch (event.key) {
      case "+":
      case "=":
        event.preventDefault();
        zoomBy(ZOOM_STEP);
        break;
      case "-":
      case "_":
        event.preventDefault();
        zoomBy(1 / ZOOM_STEP);
        break;
    }
  };

  const atMinZoom = view.zoom <= MIN_ZOOM + ZOOM_EPSILON;
  const atMaxZoom = view.zoom >= MAX_ZOOM - ZOOM_EPSILON;
  const showRedCell = view.zoom >= RED_VISIBLE_ZOOM;
  const showRedCellText = view.zoom >= RED_TEXT_VISIBLE_ZOOM;

  return (
    <section className={styles.stage} aria-label="Zoomable minimal scale grid">
      <svg
        className={styles.grid}
        viewBox={visibleArea.viewBox}
        width={GRID_SIZE}
        height={GRID_SIZE}
        role="img"
        aria-labelledby="minimal-grid-title minimal-grid-desc"
        tabIndex={0}
        onWheel={handleWheel}
        onDoubleClick={() => zoomBy(ZOOM_STEP)}
        onKeyDown={handleKeyDown}
        shapeRendering="crispEdges"
        preserveAspectRatio="none"
      >
        <title id="minimal-grid-title">Scroll or double-click to zoom</title>
        <desc id="minimal-grid-desc">
          A zoomable grid illustrating the differences in scale between one
          million, one billion, and one trillion.
        </desc>
        <rect width={GRID_SIZE} height={GRID_SIZE} fill="var(--scale-gold)" />
        <rect
          x={BILLION_X}
          y={BILLION_Y}
          width={BILLION_WIDTH}
          height={BILLION_HEIGHT}
          fill="var(--scale-blue)"
        />
        <rect
          x={MILLION_X}
          y={MILLION_Y}
          width={MILLION_CELL_SIZE}
          height={MILLION_CELL_SIZE}
          fill="var(--scale-green)"
        />
        {showRedCell ? (
          <rect
            x={RED_X}
            y={RED_Y}
            width={RED_SIZE}
            height={RED_SIZE}
            fill="var(--scale-red)"
          />
        ) : null}
        {showMillionGrid && millionGridPath ? (
          <path
            d={millionGridPath}
            fill="none"
            stroke="rgba(15, 23, 42, 0.18)"
            strokeWidth={0.55}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            aria-hidden="true"
          />
        ) : null}
        <rect
          width={GRID_SIZE}
          height={GRID_SIZE}
          fill="none"
          stroke="rgba(15, 23, 42, 0.22)"
          vectorEffect="non-scaling-stroke"
        />
        <rect
          x={BILLION_X}
          y={BILLION_Y}
          width={BILLION_WIDTH}
          height={BILLION_HEIGHT}
          fill="none"
          stroke="rgba(15, 23, 42, 0.75)"
          vectorEffect="non-scaling-stroke"
        />
        {highlightedBox ? (
          <rect
            x={highlightedBox.x}
            y={highlightedBox.y}
            width={highlightedBox.size}
            height={highlightedBox.size}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={2.25}
            strokeDasharray="8 5"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            aria-hidden="true"
          />
        ) : null}
      </svg>

      {showRedCellText ? (
        <div className={styles.redCellLabel} style={redCellLabelStyle}>
          <p className={styles.redCellLabelText}>
            <span>Statistically, this is you.</span>
            <span>
              The median net worth of an{" "}
              <span className={styles.redCellNoWrap}>
                American is $192,700.
              </span>
            </span>
            <span className={styles.redCellSource}>
              Source: Federal Reserve Survey of{" "}
              <span className={styles.redCellNoWrap}>Consumer Finances</span>
            </span>
          </p>
        </div>
      ) : null}

      <div className={styles.zoomControls} aria-label="Grid zoom controls">
        <button
          type="button"
          onClick={() => zoomBy(1 / ZOOM_STEP)}
          disabled={atMinZoom}
          aria-label="Zoom out"
        >
          −
        </button>
        <output className={styles.zoomReadout} aria-live="polite">
          {formatZoom(view.zoom)}×
        </output>
        <button
          type="button"
          onClick={() => zoomBy(ZOOM_STEP)}
          disabled={atMaxZoom}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </section>
  );
}
