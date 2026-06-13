import type { Metadata } from "next";
import "./globals.css";
import { RouteTransition } from "@/components/RouteTransition";

export const metadata: Metadata = {
  title: "DBR Check — Validate a Design Basis Report against IS codes",
  description:
    "Upload a Design Basis Report PDF. We extract the building basis, run IS-code checks, and return a cited findings report. A CivilSpace feature.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
        {/* Page content renders as a direct child of body so it hydrates normally.
            The transition curtain is an independent sibling overlay — it can't
            affect the pages' hydration or intercept their clicks. */}
        {children}
        <RouteTransition />
      </body>
    </html>
  );
}
