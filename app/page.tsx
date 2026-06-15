import localFont from "next/font/local";
import styles from "./home.module.css";
import HeroHeader from "./hero-header";
import ZoomableGrid from "./zoomable-grid";

const domaineSans = localFont({
  src: "./fonts/domaine-sans-display-thin-italic.woff2",
  weight: "100",
  style: "italic",
  display: "swap",
});

export default function Home() {
  const ampersandClass = `${domaineSans.className} ${styles.ampersand}`;

  return (
    <main className={styles.page}>
      <HeroHeader ampersandClass={ampersandClass} />
      <ZoomableGrid />
    </main>
  );
}
