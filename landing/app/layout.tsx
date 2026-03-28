import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Praesidia - Multiple Lines of Defense",
  description:
    "Real-time compliance barrier that stops legal and policy violations before they happen. PII scrubbing, legal AI reasoning, and human-in-the-loop approval across Slack, Teams, Jira, and GitHub.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
