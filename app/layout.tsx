import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Millions & Billions & Trillions",
  description:
    "Interactive visualizations that compare the scale of one million, one billion, and one trillion dollars.",
  openGraph: {
    title: "Millions & Billions & Trillions",
    description:
      "Interactive visualizations that compare the scale of one million, one billion, and one trillion dollars.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Millions & Billions & Trillions",
    description:
      "Interactive visualizations that compare the scale of one million, one billion, and one trillion dollars.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Suppress root-level hydration noise from browser extensions that mutate
    // <html>/<body>, but note this can also hide real mismatches on the app shell.
    // It should not mask hydration issues deeper in the component tree.
    // https://react.dev/reference/react-dom/client/hydrateRoot#suppressing-unavoidable-hydration-mismatch-errors
    // https://nextjs.org/docs/messages/react-hydration-error#solution-3-using-suppresshydrationwarning
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
