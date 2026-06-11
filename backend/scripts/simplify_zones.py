"""
simplify_zones.py  (one-time data prep, run locally)

The source seismic-zone overlay (Seismic zone geojson/inter_dist_zones.geojson)
is ~121 MB at 8-decimal precision — too big for GitHub (100 MB cap) and heavy on
the free Render instance. Zone-lookup does not need cm precision, so we:

  1. round all coordinates to 6 decimals (~0.11 m),
  2. apply a light Douglas-Peucker simplify (preserving topology),
  3. drop unused properties,
  4. write backend/data/seismic_zones.simplified.geojson,
  5. VALIDATE the 10 IS 1893 Annex E anchor cities still resolve to the right
     zone — if any anchor crosses a boundary, the tolerance is too high.

Run from backend/:  python scripts/simplify_zones.py
"""
import json
import os

from shapely.geometry import shape, mapping, Point
from shapely.strtree import STRtree

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(HERE), "Seismic zone geojson", "inter_dist_zones.geojson")
OUT_DIR = os.path.join(HERE, "data")
OUT = os.path.join(OUT_DIR, "seismic_zones.simplified.geojson")

# Geometry simplify tolerance in degrees. 1e-3 deg ~ 111 m — coarse enough to
# shrink the file to ~11 MB / low RAM, fine enough that all 10 IS 1893 Annex E
# anchor cities still resolve to the correct zone (validated below). Coordinates
# kept at 6 decimals so points near a retained vertex stay accurate.
SIMPLIFY_TOL = 1e-3
COORD_DECIMALS = 6

ANCHORS = {
    "Ghaziabad": (28.6692, 77.4538, "IV"),
    "Delhi":     (28.6139, 77.2090, "IV"),
    "Mumbai":    (19.0760, 72.8777, "III"),
    "Chennai":   (13.0827, 80.2707, "III"),
    "Kolkata":   (22.5726, 88.3639, "III"),
    "Bengaluru": (12.9716, 77.5946, "II"),
    "Guwahati":  (26.1445, 91.7362, "V"),
    "Bhuj":      (23.2420, 69.6669, "V"),
    "Roorkee":   (29.8543, 77.8880, "IV"),
    "Darbhanga": (26.1542, 85.8918, "V"),
}
ZONE_RANK = {"II": 2, "III": 3, "IV": 4, "V": 5}


def normalize_zone(raw):
    import re
    if raw is None:
        return None
    s = str(raw).strip().upper()
    m = re.search(r"\b(II|III|IV|V)\b", s)
    if m:
        return m.group(1)
    m = re.search(r"\b([2-5])\b", s)
    if m:
        return {"2": "II", "3": "III", "4": "IV", "5": "V"}[m.group(1)]
    return None


def round_coords(obj, nd):
    """Recursively round all numbers in a GeoJSON geometry's coordinates."""
    if isinstance(obj, (int, float)):
        return round(obj, nd)
    if isinstance(obj, list):
        return [round_coords(x, nd) for x in obj]
    return obj


def main():
    print(f"Loading source: {SRC}")
    gj = json.load(open(SRC, encoding="utf-8"))
    feats = gj.get("features", [])
    print(f"  {len(feats)} features")

    out_feats = []
    geoms_for_check, meta_for_check = [], []
    skipped = 0
    for feat in feats:
        try:
            g = shape(feat["geometry"])
        except Exception:
            skipped += 1
            continue
        if g.is_empty:
            skipped += 1
            continue
        if not g.is_valid:
            g = g.buffer(0)
        gs = g.simplify(SIMPLIFY_TOL, preserve_topology=True)
        if gs.is_empty:
            gs = g  # don't let simplify delete a small polygon
        geom = round_coords(mapping(gs), COORD_DECIMALS)
        p = feat["properties"]
        props = {
            "District": p.get("District"),
            "STATE": p.get("STATE"),
            "seismic_zo": p.get("seismic_zo"),
            "intensity_": p.get("intensity_"),
        }
        out_feats.append({"type": "Feature", "properties": props, "geometry": geom})
        # keep simplified geom for validation
        geoms_for_check.append(shape(geom))
        meta_for_check.append({"zone": normalize_zone(p.get("seismic_zo")),
                               "district": p.get("District")})
    if skipped:
        print(f"  skipped {skipped} empty/broken geometries")

    out = {"type": "FeatureCollection",
           "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
           "features": out_feats}

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    size_mb = os.path.getsize(OUT) / 1_048_576
    print(f"Wrote {OUT}  ({size_mb:.1f} MB, {len(out_feats)} features)")

    # ---- validate anchors against the SIMPLIFIED geometries ----
    tree = STRtree(geoms_for_check)
    print("\n--- ANCHOR VALIDATION (on simplified data) ---")
    ok = 0
    for city, (lat, lon, expected) in ANCHORS.items():
        pt = Point(lon, lat)
        idxs = tree.query(pt)
        hits = [int(i) for i in idxs if geoms_for_check[int(i)].covers(pt)]
        if not hits:
            print(f"  {city:11s} expected {expected:4s} -> NO HIT  ** CHECK **")
            continue
        best = max(hits, key=lambda i: ZONE_RANK.get(meta_for_check[i]["zone"] or "", 0))
        got = meta_for_check[best]["zone"] or "?"
        boundary = len({meta_for_check[i]["zone"] for i in hits}) > 1
        match = got == expected or (boundary and ZONE_RANK.get(got, 0) >= ZONE_RANK.get(expected, 0))
        ok += match
        print(f"  {city:11s} expected {expected:4s} got {got:4s}"
              f"{' (boundary)' if boundary else ''}  {'OK' if match else '** CHECK **'}")
    print(f"\n{ok}/{len(ANCHORS)} anchors passed at tolerance {SIMPLIFY_TOL}.")
    if ok < len(ANCHORS):
        print("WARNING: lower SIMPLIFY_TOL and re-run.")


if __name__ == "__main__":
    main()
