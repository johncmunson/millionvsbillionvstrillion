import localFont from "next/font/local";
import styles from "./home.module.css";
import WealthExperience from "./wealth-experience";

const ampersandFont = localFont({
  src: "./fonts/ampersand-font.woff2",
  weight: "100",
  style: "italic",
  display: "swap",
});

export default function Home() {
  const ampersandClass = `${ampersandFont.className} ${styles.ampersand}`;

  return (
    <main className={styles.page}>
      <WealthExperience ampersandClass={ampersandClass} />
    </main>
  );
}
