"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, WheelEvent } from "react";
import styles from "./home.module.css";

const GRID_SIZE = 1000;
const BILLION_WIDTH = 40;
const BILLION_HEIGHT = 25;
const BILLION_X = (GRID_SIZE - BILLION_WIDTH) / 2;
const BILLION_Y = (GRID_SIZE - BILLION_HEIGHT) / 2;
const MILLION_X = (GRID_SIZE - 1) / 2;
const MILLION_Y = (GRID_SIZE - 1) / 2;
const RED_VALUE = 190_000;
const RED_SIZE = Math.sqrt(RED_VALUE / 1_000_000);
const RED_X = MILLION_X + (1 - RED_SIZE) / 2;
const RED_Y = MILLION_Y + (1 - RED_SIZE) / 2;
const RED_VISIBLE_ZOOM = 18;
const MIN_ZOOM = 1;
const MAX_ZOOM = 512;
const ZOOM_STEP = 1.8;
const ZOOM_EPSILON = 0.001;

const INITIAL_VIEW = {
  zoom: MIN_ZOOM,
  centerX: GRID_SIZE / 2,
  centerY: GRID_SIZE / 2,
};

type View = typeof INITIAL_VIEW;

type Anchor = {
  clientX: number;
  clientY: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startCenterX: number;
  startCenterY: number;
  zoom: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeView(view: View): View {
  const zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM);
  const span = GRID_SIZE / zoom;
  const halfSpan = span / 2;

  return {
    zoom,
    centerX: clamp(view.centerX, halfSpan, GRID_SIZE - halfSpan),
    centerY: clamp(view.centerY, halfSpan, GRID_SIZE - halfSpan),
  };
}

function getBrowserScale() {
  if (typeof window === "undefined") {
    return 1;
  }

  return (window.devicePixelRatio || 1) * (window.visualViewport?.scale || 1);
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

export default function ZoomableGrid() {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const lastBrowserScaleRef = useRef<number | null>(null);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [isDragging, setIsDragging] = useState(false);

  const viewBox = useMemo(() => {
    const span = GRID_SIZE / view.zoom;
    const left = view.centerX - span / 2;
    const top = view.centerY - span / 2;

    return `${left} ${top} ${span} ${span}`;
  }, [view]);

  const getZoomedView = useCallback(
    (current: View, nextZoom: number, anchor?: Anchor) => {
      const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      const svg = svgRef.current;

      if (!anchor || !svg) {
        return normalizeView({ ...current, zoom });
      }

      const rect = svg.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        return normalizeView({ ...current, zoom });
      }

      const currentSpan = GRID_SIZE / current.zoom;
      const nextSpan = GRID_SIZE / zoom;
      const ratioX = clamp((anchor.clientX - rect.left) / rect.width, 0, 1);
      const ratioY = clamp((anchor.clientY - rect.top) / rect.height, 0, 1);
      const anchorX = current.centerX - currentSpan / 2 + ratioX * currentSpan;
      const anchorY = current.centerY - currentSpan / 2 + ratioY * currentSpan;

      return normalizeView({
        zoom,
        centerX: anchorX + (0.5 - ratioX) * nextSpan,
        centerY: anchorY + (0.5 - ratioY) * nextSpan,
      });
    },
    [],
  );

  const zoomBy = useCallback(
    (factor: number, anchor?: Anchor) => {
      setView((current) =>
        getZoomedView(current, current.zoom * factor, anchor),
      );
    },
    [getZoomedView],
  );

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

  const reset = useCallback(() => {
    setView(INITIAL_VIEW);
    dragRef.current = null;
    lastBrowserScaleRef.current = getBrowserScale();
    setIsDragging(false);
  }, []);

  const panBy = useCallback((deltaX: number, deltaY: number) => {
    setView((current) =>
      normalizeView({
        ...current,
        centerX: current.centerX + deltaX,
        centerY: current.centerY + deltaY,
      }),
    );
  }, []);

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (view.zoom <= MIN_ZOOM + ZOOM_EPSILON) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCenterX: view.centerX,
      startCenterY: view.centerY,
      zoom: view.zoom,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    const span = GRID_SIZE / drag.zoom;
    const deltaX = ((event.clientX - drag.startX) / rect.width) * span;
    const deltaY = ((event.clientY - drag.startY) / rect.height) * span;

    setView(
      normalizeView({
        zoom: drag.zoom,
        centerX: drag.startCenterX - deltaX,
        centerY: drag.startCenterY - deltaY,
      }),
    );
  };

  const handlePointerEnd = (event: PointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRef.current = null;
    setIsDragging(false);
  };

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const panDistance = GRID_SIZE / view.zoom / 10;

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
      case "0":
      case "Escape":
        event.preventDefault();
        reset();
        break;
      case "ArrowLeft":
        event.preventDefault();
        panBy(-panDistance, 0);
        break;
      case "ArrowRight":
        event.preventDefault();
        panBy(panDistance, 0);
        break;
      case "ArrowUp":
        event.preventDefault();
        panBy(0, -panDistance);
        break;
      case "ArrowDown":
        event.preventDefault();
        panBy(0, panDistance);
        break;
    }
  };

  const atMinZoom = view.zoom <= MIN_ZOOM + ZOOM_EPSILON;
  const atMaxZoom = view.zoom >= MAX_ZOOM - ZOOM_EPSILON;
  const showRedCell = view.zoom >= RED_VISIBLE_ZOOM;

  const gridClassName = [
    styles.grid,
    !atMinZoom ? styles.zoomed : "",
    isDragging ? styles.dragging : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={styles.stage} aria-label="Zoomable minimal scale grid">
      <svg
        ref={svgRef}
        className={gridClassName}
        viewBox={viewBox}
        width={GRID_SIZE}
        height={GRID_SIZE}
        role="img"
        aria-labelledby="minimal-grid-title minimal-grid-desc"
        tabIndex={0}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDoubleClick={(event) =>
          zoomBy(ZOOM_STEP, { clientX: event.clientX, clientY: event.clientY })
        }
        onKeyDown={handleKeyDown}
        shapeRendering="crispEdges"
        preserveAspectRatio="none"
      >
        <title id="minimal-grid-title">
          One million, one billion, and one trillion as a zoomable grid
        </title>
        <desc id="minimal-grid-desc">
          Each unit in the square represents one million. The centered green
          unit is one million. A smaller centered red square inside it
          represents roughly one hundred ninety thousand. A centered forty by
          twenty-five box contains one thousand units, representing one billion.
          The full one thousand by one thousand grid represents one trillion.
          Scroll over the grid or use the zoom buttons to zoom while keeping the
          grid full screen.
        </desc>
        <rect width={GRID_SIZE} height={GRID_SIZE} fill="#d9a21b" />
        <rect
          x={BILLION_X}
          y={BILLION_Y}
          width={BILLION_WIDTH}
          height={BILLION_HEIGHT}
          fill="#2563eb"
        />
        <rect x={MILLION_X} y={MILLION_Y} width="1" height="1" fill="#16a34a" />
        {showRedCell ? (
          <rect
            x={RED_X}
            y={RED_Y}
            width={RED_SIZE}
            height={RED_SIZE}
            fill="#dc2626"
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
      </svg>

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
        <button
          type="button"
          onClick={reset}
          disabled={atMinZoom}
          aria-label="Reset zoom"
        >
          Reset
        </button>
      </div>

      <p className={styles.zoomHint}>
        Scroll to zoom · red appears inside green · 0 resets
      </p>
    </section>
  );
}
