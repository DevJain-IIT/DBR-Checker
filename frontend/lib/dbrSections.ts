// The generated DBR follows the section order of a real signed DBR
// (TATA CENTRE Tower C, doc TCG-C-STR-DBR-1). Each canonical section has a key,
// title, and the keywords used to match a captured `document.sections` heading
// to it. Captured sections that match none of these fall through to an appendix
// ("Additional sections from your DBR") so nothing from the original is lost.

import type { DbrSection } from "@/lib/types";

export interface DbrTemplateSection {
  key: string;
  num: number;        // section number shown in the document
  title: string;
  keywords: string[]; // lowercased substrings matched against a captured heading
}

// The 13-section template (order = the real DBR's table of contents).
export const DBR_TEMPLATE: DbrTemplateSection[] = [
  { key: "introduction", num: 1, title: "Introduction", keywords: ["introduction", "general", "preamble"] },
  { key: "scope", num: 2, title: "Scope", keywords: ["scope"] },
  { key: "description", num: 3, title: "Description of the Buildings", keywords: ["description", "building", "geometry", "configuration"] },
  { key: "seismic", num: 4, title: "Seismic Classification", keywords: ["seismic classification", "seismic", "earthquake"] },
  { key: "meteorological", num: 5, title: "Meteorological Condition", keywords: ["meteorolog", "exposure", "wind", "climat"] },
  { key: "fire_cover", num: 6, title: "Fire Rating & Clear Cover", keywords: ["fire", "clear cover", "cover", "durability"] },
  { key: "geotechnical", num: 7, title: "Geotechnical Parameters", keywords: ["geotechnical", "soil", "foundation parameter", "bearing"] },
  { key: "materials", num: 8, title: "Material Grades", keywords: ["material", "grade", "concrete", "reinforcement", "steel", "cement"] },
  { key: "construction", num: 9, title: "Constructional Features", keywords: ["constructional", "construction feature", "structural system", "framing"] },
  { key: "methodology", num: 10, title: "Analysis & Design Methodology", keywords: ["analysis", "design methodology", "methodology", "load", "combination", "model", "limit state"] },
  { key: "software", num: 11, title: "Computer Programs", keywords: ["computer program", "software", "tools"] },
  { key: "codes", num: 12, title: "Applicable Codes", keywords: ["applicable code", "code", "standard", "reference"] },
  { key: "conclusion", num: 13, title: "Conclusion & Recommendations", keywords: ["conclusion", "recommendation", "summary"] },
];

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().trim();

// Headings that are document chrome, not real content — drop entirely.
const IGNORE_HEADINGS = ["contents", "table of contents", "index", "revision details", "revision history"];

// Match a captured heading to a canonical section key, "ignore", or null (=> appendix).
export function matchSectionKey(heading: string | null | undefined): string | "ignore" | null {
  const h = norm(heading);
  if (!h) return null;
  if (IGNORE_HEADINGS.some((k) => h === k || h.startsWith(k))) return "ignore";
  for (const sec of DBR_TEMPLATE) {
    if (sec.keywords.some((k) => h.includes(k))) return sec.key;
  }
  return null;
}

// Group captured sections by canonical key. Returns { byKey, appendix } where
// byKey[key] is the captured sections (in original order) that mapped to it, and
// appendix is the leftover captured sections that matched nothing.
export function groupSections(sections: DbrSection[] | undefined): {
  byKey: Record<string, DbrSection[]>;
  appendix: DbrSection[];
} {
  const byKey: Record<string, DbrSection[]> = {};
  const appendix: DbrSection[] = [];
  const ordered = [...(sections ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const s of ordered) {
    const key = matchSectionKey(s.heading);
    if (key === "ignore") continue;
    if (key) { (byKey[key] ||= []).push(s); continue; }
    // unmapped → appendix, but only if it actually carries content (skip empty/
    // untitled split fragments so the appendix stays clean).
    const hasContent = (s.prose && s.prose.trim()) || (s.tables && s.tables.length) || (s.values && Object.keys(s.values).length);
    if (hasContent) appendix.push(s);
  }
  return { byKey, appendix };
}
