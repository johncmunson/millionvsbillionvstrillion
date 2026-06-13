import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Million vs Billion vs Trillion",
  description:
    "Interactive visualizations that compare the scale of one million, one billion, and one trillion dollars.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
