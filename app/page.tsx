import type { Metadata } from "next";
import styles from "./home.module.css";
import ZoomableGrid from "./zoomable-grid";

export const metadata: Metadata = {
  title: "Minimal Scale Grid | Million vs Billion vs Trillion",
  description:
    "A minimal one-cell-per-million grid comparing one million, one billion, and one trillion.",
};

export default function Home() {
  const millionTittle = `${styles.tittleI} ${styles.tittleMillion}`;
  const billionTittle = `${styles.tittleI} ${styles.tittleBillion}`;
  const trillionTittle = `${styles.tittleI} ${styles.tittleTrillion}`;

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
            {"on / B"}
            <span className={billionTittle}>i</span>
            {"ll"}
            <span className={billionTittle}>i</span>
            {"on / Tr"}
            <span className={trillionTittle}>i</span>
            {"ll"}
            <span className={trillionTittle}>i</span>
            {"on"}
          </h1>
          <p className="ml-1.5!">
            A million is life-changing. A billion is power. A trillion is what
            happens when power compounds for long enough. The scale is hard to
            see until you put it on a grid.
          </p>
        </div>

        <dl className={styles.key} aria-label="Scale key">
          <div>
            <dt className={styles.green}>$1 Million</dt>
            <dd>A lot of money</dd>
          </div>
          <div>
            <dt className={styles.blue}>$1 Billion</dt>
            <dd>A shit ton of money</dd>
          </div>
          <div>
            <dt className={styles.gold}>$1 Trillion</dt>
            <dd>An unfathomable amount of money</dd>
          </div>
        </dl>
      </header>

      <ZoomableGrid />
    </main>
  );
}
