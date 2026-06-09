// Per-check methodology reference (D1–D25), transcribed from the vetting-report
// template (Park_Town_Vetting_Methodology_and_Findings-3.docx, "1.1 Checks
// applied" tables). Used to render the document-style export with the same
// "Governing code & clause" + "Method" columns as the source report.

export interface CheckMeta {
  governing: string;
  method: string;
}

export const CHECK_META: Record<string, CheckMeta> = {
  D1: {
    governing: "QA / document control (no IS clause)",
    method: "Read title block & headers; check for stale/copied content.",
  },
  D2: {
    governing: "IS 269:2015, IS 875-3:2015, IS 1893:2016, IS 16700:2023, IS 13920:2016, NBC 2016",
    method: "Compare the cited code table against current BIS editions.",
  },
  D3: {
    governing: "IS 456:2000 Cl 8.2.2.1 & Table 3 (exposure); Table 16 (durability cover); Table 16A (fire cover)",
    method: "Check declared exposure vs site; check cover schedule consistency.",
  },
  D4: {
    governing: "IS 456:2000 Table 5 (min grade for durability); IS 16700 (tall-building grades)",
    method: "Check minimum M-grade and element-wise grades.",
  },
  D5: {
    governing: "IS 1786:2008; IS 13920:2016 Cl 5.5 (grade ≤ Fe550D, elongation)",
    method: "Check bar grade & stated elongation/ductility.",
  },
  D6: {
    governing: "IS 269:2015 (OPC); IS 1489 Part 1 (PPC)",
    method: "Check the cement codes cited.",
  },
  D7: {
    governing: "IS 1893:2016 — Z, I, R tables; Cl 7.8.2 (eccentricity); Cl 7.2.4 (damping)",
    method: "Verify each value vs zone / occupancy / structural system.",
  },
  D8: {
    governing: "IS 16700:2023 (Ta for >50 m; Cl 5.5 Tmax = 8 s); cf. IS 1893:2016 Cl 7.6.2",
    method: "Recompute Ta from H; check coefficient & 8 s cap.",
  },
  D9: {
    governing: "IS 16700:2023 Cl 7.2",
    method: "Check cracked-section modifier values for wall / beam / slab / column.",
  },
  D10: {
    governing: "IS 1893:2016 Cl 7.3.1 & Table 10; Cl 7.3.2 (roof live excluded)",
    method: "Check % of imposed load for ≤3 and >3 kN/m².",
  },
  D11: {
    governing: "IS 1893:2016 Cl 7.11.1 (0.004h); IS 456 Cl 23.2; IS 16700 (wind H/500)",
    method: "Check stated drift & deflection limits.",
  },
  D12: {
    governing: "IS 1893:2016 Cl 7.6.4",
    method: "Check rigid / semi-rigid diaphragm declaration.",
  },
  D13: {
    governing: "IS 875-3:2015 — Vb (Annex A), terrain Cl 6.3.2.1, K1 Table 1, K2/K3/K4, Cf Cl 7.4",
    method: "Check Vb, terrain, K-factors, force coefficients, return period.",
  },
  D14: {
    governing: "IS 456:2000 Cl 36.4 & Table 18; IS 1893:2016 Cl 6.3; IS 875-5 (combination)",
    method: "Check combination families & partial safety factors.",
  },
  D15: {
    governing: "IS 1904; IS 2950 (raft); IS 2911 (pile); IS 16700:2023 Section 9",
    method: "Check founding type / depth, SBC, GWT, FoS & settlement.",
  },
  D16: {
    governing: "IS 16700:2023 (P-Δ combination & stability coefficient θ — 2023 revision)",
    method: "Check whether second-order / P-Δ stability is addressed (θ ≤ 0.2).",
  },
  D17: {
    governing: "IS 1893:2016 Cl 7.2 / Table 9 (LLRS→R); IS 16700:2023 (system classification & height)",
    method: "Check system is named, classified, permitted at the height, and R justified.",
  },
  D18: {
    governing: "IS 1893:2016 Cl 7.1, Table 6 (b) mass & (c) vertical-geometric; IS 16700:2023",
    method: "Check storey-mass (≤150% adjacent) and LLRS-dimension (≤125% adjacent) irregularities.",
  },
  D19: {
    governing: "IS 1893:2016 Annex E (zone from location); IS 875-3:2015 Annex A (Vb); IS 16700:2023",
    method: "Check site lat/long and plan dimensions / aspect ratio are stated.",
  },
  D20: {
    governing: "IS 456:2000 Cl 27 (expansion joints, >45 m); IS 875 Part 5 (temperature load)",
    method: "Check ΔT basis, shrinkage strategy, and expansion-joint provision.",
  },
  D21: {
    governing: "IS 875-3:2015 Cl 10 (dynamic/gust-factor); IS 16700:2023 (wind-tunnel thresholds)",
    method: "Check tunnel decision + justification, and dynamic (gust) wind treatment.",
  },
  D22: {
    governing: "IS 16700:2023 (analysis & software validation); QA good practice",
    method: "Check each tool's purpose, analysis type and validation are stated; versions consistent.",
  },
  D23: {
    governing: "IS 456:2000 Cl 21, Fig 1, Table 16A, Cl 26.4; NBC 2016 Part 4",
    method: "Check ratings, min dimensions, cover-per-rating verification + anti-spalling.",
  },
  D24: {
    governing: "IS 456:2000 Cl 26.4, Table 16 (durability), Table 16A (fire), Cl 26.4.2.1 (cover ≥ bar dia)",
    method: "Check nominal/clear cover defined, basis = max(durability, fire), schedule consistent.",
  },
  D25: {
    governing: "NBC 2016 Part 4, Table 2 (construction type vs occupancy / height & fire rating)",
    method: "Check the construction type is stated and correctly justified.",
  },
};
