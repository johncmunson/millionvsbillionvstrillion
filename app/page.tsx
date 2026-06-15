import localFont from "next/font/local";
import styles from "./home.module.css";
import ZoomableGrid from "./zoomable-grid";

const domaineSans = localFont({
  src: "./fonts/domaine-sans-display-thin-italic.woff2",
  weight: "100",
  style: "italic",
  display: "swap",
});

export default function Home() {
  const millionTittle = `${styles.tittleI} ${styles.tittleMillion}`;
  const billionTittle = `${styles.tittleI} ${styles.tittleBillion}`;
  const trillionTittle = `${styles.tittleI} ${styles.tittleTrillion}`;
  const ampersandClass = `${domaineSans.className} ${styles.ampersand}`;
  const figurePromptText = "Visualize the net worth of a public figure";
  const figurePromptKeyClass = `${styles.figurePrompt} ${styles.figurePromptKey}`;
  const figurePromptSubheadingClass = `${styles.figurePrompt} ${styles.figurePromptSubheading}`;

  return (
    <main className={styles.page}>
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
            <button className={figurePromptSubheadingClass} type="button">
              {figurePromptText}
            </button>
          </div>
        </div>

        <div className={styles.keyGroup}>
          <ul className={styles.key} aria-label="Scale key">
            <li className={styles.keyItem}>
              <button
                className={styles.keyButton}
                type="button"
                data-grid-zoom-target="645"
                aria-label="Zoom grid to the $1 Million scale at 645×"
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
          <button className={figurePromptKeyClass} type="button">
            {figurePromptText}
          </button>
        </div>
      </header>

      <ZoomableGrid />
    </main>
  );
}
