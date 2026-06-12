import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DBR Check — Validate a Design Basis Report against IS codes",
  description:
    "Upload a Design Basis Report PDF. We extract the building basis, run IS-code checks, and return a cited findings report. A CivilSpace feature.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Inter, system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
