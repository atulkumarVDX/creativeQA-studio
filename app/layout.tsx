import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Turbo QA Studio",
  description: "Local-first creative validation and review for VDX Turbo packages.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
