"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import styles from "./home.module.css";
import { MAX_VISUALIZED_NET_WORTH } from "./net-worth";
import type { NetWorthLookupResult } from "./net-worth";

type HeroHeaderProps = {
  ampersandClass: string;
  onLookupResult: (result: NetWorthLookupResult) => void;
  onReset: () => void;
};

type FigurePanelMode = "key" | "form" | "loading" | "result";

const FIGURE_PROMPT_TEXT = "Visualize the net worth of a public figure";

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
      <path d="m21.854 2.147-10.94 10.939" />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function formatNetWorth(value: number) {
  const units = [
    { threshold: 1_000_000_000_000, divisor: 1_000_000_000_000, label: "trillion" },
    { threshold: 1_000_000_000, divisor: 1_000_000_000, label: "billion" },
    { threshold: 1_000_000, divisor: 1_000_000, label: "million" },
  ];

  for (const unit of units) {
    if (value >= unit.threshold) {
      const scaled = value / unit.divisor;
      const formatted = Number.isInteger(scaled)
        ? scaled.toLocaleString()
        : scaled.toLocaleString(undefined, { maximumFractionDigits: 1 });

      return `$${formatted} ${unit.label}`;
    }
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getResultCopy(result: NetWorthLookupResult) {
  if (result.status === "found" && result.estimated_net_worth !== null) {
    const netWorth = result.estimated_net_worth;
    const visualizationLimitCopy =
      netWorth > MAX_VISUALIZED_NET_WORTH
        ? ", an amount larger than what can be visualized on our grid!"
        : ".";

    return {
      message: `${result.name} has an approximate net worth of ${formatNetWorth(
        netWorth,
      )}${visualizationLimitCopy}`,
      sourceLabel: result.sources.length === 1 ? "Source" : "Sources",
      sources: result.sources,
    };
  }

  if (result.status === "ambiguous") {
    const qualifierExample =
      result.qualifier_example || `${result.name}, the actor`;

    return {
      message: `It's unclear which ${result.name} you are referring to. Try again using a qualifier, e.g. "${qualifierExample}"`,
      sources: null,
    };
  }

  return {
    message: `Unable to find publicly available net worth data for ${result.name}.`,
    sources: null,
  };
}

export default function HeroHeader({
  ampersandClass,
  onLookupResult,
  onReset,
}: HeroHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const [figurePanelMode, setFigurePanelMode] =
    useState<FigurePanelMode>("key");
  const [figureName, setFigureName] = useState("");
  const [lookupResult, setLookupResult] =
    useState<NetWorthLookupResult | null>(null);
  const millionTittle = `${styles.tittleI} ${styles.tittleMillion}`;
  const billionTittle = `${styles.tittleI} ${styles.tittleBillion}`;
  const trillionTittle = `${styles.tittleI} ${styles.tittleTrillion}`;
  const isFigurePanelOpen = figurePanelMode !== "key";
  const isFigureFormVisible =
    figurePanelMode === "form" || figurePanelMode === "loading";
  const isFigureLoading = figurePanelMode === "loading";
  const isFigureResultVisible = figurePanelMode === "result";
  const figurePromptKeyClass = `${styles.figurePrompt} ${styles.figurePromptKey}`;
  const figurePromptSubheadingClass = `${styles.figurePrompt} ${styles.figurePromptSubheading} ${
    isFigurePanelOpen ? styles.figurePromptHidden : ""
  }`;
  const figurePanelClass = `${styles.figurePanel} ${
    isFigurePanelOpen ? styles.figurePanelOpen : ""
  } ${isFigureFormVisible ? styles.figurePanelShowForm : ""} ${
    isFigureResultVisible ? styles.figurePanelShowInfo : ""
  }`;
  const trimmedFigureName = figureName.trim();
  const resultCopy = useMemo(
    () => (lookupResult ? getResultCopy(lookupResult) : null),
    [lookupResult],
  );

  const abortPendingRequest = () => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
  };

  const resetFigurePanel = () => {
    abortPendingRequest();
    setFigurePanelMode("key");
    setFigureName("");
    setLookupResult(null);
    onReset();
  };

  const openFigureForm = () => {
    abortPendingRequest();
    setLookupResult(null);
    setFigurePanelMode("form");
    onReset();
  };

  useEffect(() => {
    if (figurePanelMode !== "form") {
      return;
    }

    inputRef.current?.focus();
  }, [figurePanelMode]);

  useEffect(() => {
    return () => {
      requestAbortRef.current?.abort();
    };
  }, []);

  const handleFigureNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFigureName(event.target.value);
  };

  const handleFigureSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!trimmedFigureName || isFigureLoading) {
      return;
    }

    abortPendingRequest();

    const abortController = new AbortController();
    requestAbortRef.current = abortController;
    setLookupResult(null);
    setFigurePanelMode("loading");
    onReset();

    try {
      const response = await fetch("/api/net-worth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedFigureName }),
        signal: abortController.signal,
      });
      const data = (await response.json()) as
        | NetWorthLookupResult
        | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Lookup failed");
      }

      if (requestAbortRef.current !== abortController) {
        return;
      }

      const result = data as NetWorthLookupResult;
      setLookupResult(result);
      setFigurePanelMode("result");
      onLookupResult(result);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      const fallbackResult: NetWorthLookupResult = {
        status: "not_found",
        name: trimmedFigureName,
        estimated_net_worth: null,
        sources: [],
        message: `Unable to find publicly available net worth data for ${trimmedFigureName}.`,
        qualifier_example: null,
      };

      if (requestAbortRef.current !== abortController) {
        return;
      }

      setLookupResult(fallbackResult);
      setFigurePanelMode("result");
      onLookupResult(fallbackResult);
    } finally {
      if (requestAbortRef.current === abortController) {
        requestAbortRef.current = null;
      }
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        {/* <p className={styles.rule}>There&apos;s levels to this</p> */}
        <h1>
          {"M"}
          <span className={millionTittle}>i</span>
          {"ll"}
          <span className={millionTittle}>i</span>
          {"ons "}
          <span className={ampersandClass}>&amp;</span>
          {" B"}
          <span className={billionTittle}>i</span>
          {"ll"}
          <span className={billionTittle}>i</span>
          {"ons "}
          <span className={ampersandClass}>&amp;</span>
          {" Tr"}
          <span className={trillionTittle}>i</span>
          {"ll"}
          <span className={trillionTittle}>i</span>
          {"ons"}
        </h1>
        <div className={styles.subheadingGroup}>
          <p>
            A million dollars is life-changing. A billion is power. A trillion
            is what happens when power compounds for long enough. The scale is
            hard to see until you put it on a grid.
          </p>
          <button
            className={figurePromptSubheadingClass}
            type="button"
            onClick={openFigureForm}
            disabled={isFigurePanelOpen}
            aria-controls="public-figure-panel"
            aria-expanded={isFigurePanelOpen}
          >
            {FIGURE_PROMPT_TEXT}
          </button>
        </div>
      </div>

      <div className={styles.keyGroup}>
        <div id="public-figure-panel" className={figurePanelClass}>
          <div className={styles.figurePanelKey} aria-hidden={isFigurePanelOpen}>
            <ul className={styles.key} aria-label="Scale key">
              <li className={styles.keyItem}>
                <button
                  className={styles.keyButton}
                  type="button"
                  data-grid-zoom-target="645"
                  aria-label="Zoom grid to the $1 Million scale at 645×"
                  disabled={isFigurePanelOpen}
                >
                  <span className={`${styles.keyTerm} ${styles.green}`}>
                    $1 Million
                  </span>
                  <span className={styles.keyDescription}>A lot of money</span>
                </button>
              </li>
              <li className={styles.keyItem}>
                <button
                  className={styles.keyButton}
                  type="button"
                  data-grid-zoom-target="20"
                  aria-label="Zoom grid to the $1 Billion scale at 20×"
                  disabled={isFigurePanelOpen}
                >
                  <span className={`${styles.keyTerm} ${styles.blue}`}>
                    $1 Billion
                  </span>
                  <span className={styles.keyDescription}>
                    A shit ton of money
                  </span>
                </button>
              </li>
              <li className={styles.keyItem}>
                <button
                  className={styles.keyButton}
                  type="button"
                  data-grid-zoom-target="1"
                  aria-label="Zoom grid to the $1 Trillion scale at 1×"
                  disabled={isFigurePanelOpen}
                >
                  <span className={`${styles.keyTerm} ${styles.gold}`}>
                    $1 Trillion
                  </span>
                  <span className={styles.keyDescription}>
                    An unfathomable amount of money
                  </span>
                </button>
              </li>
            </ul>
            <button
              className={figurePromptKeyClass}
              type="button"
              onClick={openFigureForm}
              disabled={isFigurePanelOpen}
              aria-controls="public-figure-panel"
              aria-expanded={isFigurePanelOpen}
            >
              {FIGURE_PROMPT_TEXT}
            </button>
          </div>

          <form
            id="public-figure-form"
            className={styles.figureForm}
            onSubmit={handleFigureSubmit}
            aria-hidden={!isFigureFormVisible}
            aria-busy={isFigureLoading}
          >
            <label
              className={styles.visuallyHidden}
              htmlFor="public-figure-input"
            >
              Public figure name
            </label>
            <input
              id="public-figure-input"
              ref={inputRef}
              className={styles.figureInput}
              name="publicFigure"
              type="text"
              placeholder="Enter a name..."
              autoComplete="off"
              value={figureName}
              onChange={handleFigureNameChange}
              disabled={!isFigureFormVisible || isFigureLoading}
              required
            />
            <button
              className={styles.figureSubmit}
              type="submit"
              disabled={figurePanelMode !== "form" || !trimmedFigureName}
              aria-label={
                isFigureLoading ? "Looking up public figure" : "Submit public figure"
              }
            >
              {isFigureLoading ? (
                <span className={styles.figureSpinner} aria-hidden="true" />
              ) : (
                <SendIcon />
              )}
            </button>
            <button
              className={styles.figureCancel}
              type="button"
              onClick={resetFigurePanel}
              disabled={!isFigureFormVisible}
              aria-label="Cancel public figure entry"
            >
              <CancelIcon />
            </button>
            <span className={styles.visuallyHidden} aria-live="polite">
              {isFigureLoading ? "Looking up net worth data..." : ""}
            </span>
          </form>

          <div
            className={styles.figureInfo}
            role="status"
            aria-live="polite"
            aria-hidden={!isFigureResultVisible}
          >
            {resultCopy ? (
              <>
                <div className={styles.figureInfoCopy}>
                  <p>{resultCopy.message}</p>
                  {resultCopy.sources ? (
                    <p className={styles.figureSources}>
                      {resultCopy.sourceLabel}:{" "}
                      {resultCopy.sources.length > 0
                        ? resultCopy.sources.map((source, index) => (
                            <Fragment key={`${source.url}-${source.name}`}>
                              {index > 0 ? ", " : null}
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {source.name}
                              </a>
                            </Fragment>
                          ))
                        : "Not provided"}
                    </p>
                  ) : null}
                </div>
                <button
                  className={styles.figureReset}
                  type="button"
                  onClick={resetFigurePanel}
                >
                  Reset
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
