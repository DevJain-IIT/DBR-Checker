"""
zone_resolver.py

Lat/Long -> IS 1893 seismic zone via point-in-polygon over the district x zone
overlay (Fig. 1 / Annex E), simplified to backend/data/seismic_zones.simplified
.geojson (~10 MB, ~70 MB RAM). Adapted from the original QGIS-export resolver.

Loaded LAZILY (get_resolver()) on the first /api/location/zone request so the
main app boots fast and only pays the RAM cost if coordinate lookup is used.

Requires: shapely >= 2.0
"""
from __future__ import annotations

import json
import os
import re
import threading
from typing import Optional

GEOJSON_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "data", "seismic_zones.simplified.geojson")

ZONE_FIELD = "seismic_zo"
DISTRICT_FIELD = "District"
STATE_FIELD = "STATE"
INTENSITY_FIELD = "intensity_"
ZONE_RANK = {"II": 2, "III": 3, "IV": 4, "V": 5}


def normalize_zone(raw) -> Optional[str]:
    """'IV', 'Zone IV', 'Seismic Zone-III', 4, '4' -> 'II'..'V'."""
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


def _geom_bbox(geom: dict):
    """(min_lon, min_lat, max_lon, max_lat) over all coords of a GeoJSON geometry."""
    minx = miny = float("inf")
    maxx = maxy = float("-inf")

    def walk(coords):
        nonlocal minx, miny, maxx, maxy
        # coords is nested lists; leaves are [lon, lat]
        if coords and isinstance(coords[0], (int, float)):
            x, y = coords[0], coords[1]
            if x < minx: minx = x
            if x > maxx: maxx = x
            if y < miny: miny = y
            if y > maxy: maxy = y
        else:
            for c in coords:
                walk(c)

    walk(geom.get("coordinates", []))
    return (minx, miny, maxx, maxy)


class ZoneResolver:
    """
    Query-on-demand resolver (low memory). At init we keep only each feature's
    raw geometry dict + a precomputed bounding box + metadata — NO shapely
    objects. On lookup we bbox-filter to the few candidate polygons that could
    contain the point, build shapely geometries for ONLY those, test, and discard.
    Peak RAM is a few tens of MB instead of ~300 MB.
    """
    def __init__(self, geojson_path: str = GEOJSON_FILE):
        with open(geojson_path, encoding="utf-8") as f:
            gj = json.load(f)
        feats = gj.get("features", [])
        if not feats:
            raise ValueError("GeoJSON contains 0 features.")

        self.features = []  # list of {geom, bbox, zone, district, state, intensity}
        for feat in feats:
            geom = feat.get("geometry")
            if not geom or not geom.get("coordinates"):
                continue
            try:
                bbox = _geom_bbox(geom)
            except Exception:
                continue
            p = feat.get("properties", {})
            self.features.append({
                "geom": geom,
                "bbox": bbox,
                "zone": normalize_zone(p.get(ZONE_FIELD)),
                "district": p.get(DISTRICT_FIELD),
                "state": p.get(STATE_FIELD),
                "intensity": p.get(INTENSITY_FIELD),
            })
        # gj (and its parsed dicts) are still referenced via feature['geom'], but
        # we no longer hold any shapely C-objects — the heavy part is gone.

    @property
    def geoms(self):  # back-compat for health endpoint count
        return self.features

    def lookup(self, lat: float, lon: float) -> Optional[dict]:
        """{'zone','district','state','intensity','boundary_case'} or None."""
        from shapely.geometry import shape, Point  # local import: heavy native dep
        pt = Point(lon, lat)  # shapely is (x=lon, y=lat)

        hits = []
        for f in self.features:
            minx, miny, maxx, maxy = f["bbox"]
            # cheap bbox reject before building any geometry
            if not (minx <= lon <= maxx and miny <= lat <= maxy):
                continue
            try:
                g = shape(f["geom"])
                if not g.is_valid:
                    g = g.buffer(0)
                if g.covers(pt):
                    hits.append(f)
            except Exception:
                continue
        if not hits:
            return None
        # Conservative: on a shared boundary between different zones, return the higher.
        best = max(hits, key=lambda f: ZONE_RANK.get(f["zone"] or "", 0))
        return {
            "zone": best["zone"], "district": best["district"],
            "state": best["state"], "intensity": best["intensity"],
            "boundary_case": len({f["zone"] for f in hits}) > 1,
        }


# ---- lazy singleton ----
_resolver: Optional[ZoneResolver] = None
_lock = threading.Lock()


def get_resolver() -> ZoneResolver:
    """Build the resolver on first use; cached thereafter. Thread-safe."""
    global _resolver
    if _resolver is None:
        with _lock:
            if _resolver is None:
                _resolver = ZoneResolver()
    return _resolver
