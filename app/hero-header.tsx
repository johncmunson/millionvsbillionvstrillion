"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./home.module.css";

type HeroHeaderProps = {
  ampersandClass: string;
};

const FIGURE_PROMPT_TEXT = "Visualize the net worth of a public figure";

export default function HeroHeader({ ampersandClass }: HeroHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFigureFormOpen, setIsFigureFormOpen] = useState(false);
  const millionTittle = `${styles.tittleI} ${styles.tittleMillion}`;
  const billionTittle = `${styles.tittleI} ${styles.tittleBillion}`;
  const trillionTittle = `${styles.tittleI} ${styles.tittleTrillion}`;
  const figurePromptKeyClass = `${styles.figurePrompt} ${styles.figurePromptKey}`;
  const figurePromptSubheadingClass = `${styles.figurePrompt} ${styles.figurePromptSubheading} ${
    isFigureFormOpen ? styles.figurePromptHidden : ""
  }`;
  const figurePanelClass = `${styles.figurePanel} ${
    isFigureFormOpen ? styles.figurePanelOpen : ""
  }`;

  const openFigureForm = () => {
    setIsFigureFormOpen(true);
  };

  const closeFigureForm = () => {
    setIsFigureFormOpen(false);
  };

  useEffect(() => {
    if (!isFigureFormOpen) {
      return;
    }

    inputRef.current?.focus();
  }, [isFigureFormOpen]);

  const handleFigureSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
            disabled={isFigureFormOpen}
            aria-controls="public-figure-form"
            aria-expanded={isFigureFormOpen}
          >
            {FIGURE_PROMPT_TEXT}
          </button>
        </div>
      </div>

      <div className={styles.keyGroup}>
        <div className={figurePanelClass}>
          <div className={styles.figurePanelKey} aria-hidden={isFigureFormOpen}>
            <ul className={styles.key} aria-label="Scale key">
              <li className={styles.keyItem}>
                <button
                  className={styles.keyButton}
                  type="button"
                  data-grid-zoom-target="645"
                  aria-label="Zoom grid to the $1 Million scale at 645×"
                  disabled={isFigureFormOpen}
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
                  disabled={isFigureFormOpen}
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
                  disabled={isFigureFormOpen}
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
              disabled={isFigureFormOpen}
              aria-controls="public-figure-form"
              aria-expanded={isFigureFormOpen}
            >
              {FIGURE_PROMPT_TEXT}
            </button>
          </div>

          <form
            id="public-figure-form"
            className={styles.figureForm}
            onSubmit={handleFigureSubmit}
            aria-hidden={!isFigureFormOpen}
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
              disabled={!isFigureFormOpen}
            />
            <button
              className={styles.figureSubmit}
              type="submit"
              disabled={!isFigureFormOpen}
              aria-label="Submit public figure"
            >
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
            </button>
            <button
              className={styles.figureCancel}
              type="button"
              onClick={closeFigureForm}
              disabled={!isFigureFormOpen}
              aria-label="Cancel public figure entry"
            >
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
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
