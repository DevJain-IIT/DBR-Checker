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


class ZoneResolver:
    def __init__(self, geojson_path: str = GEOJSON_FILE):
        from shapely.geometry import shape  # local import: heavy native dep
        from shapely.strtree import STRtree

        with open(geojson_path, encoding="utf-8") as f:
            gj = json.load(f)
        feats = gj.get("features", [])
        if not feats:
            raise ValueError("GeoJSON contains 0 features.")

        self.geoms, self.meta = [], []
        for feat in feats:
            try:
                g = shape(feat["geometry"])
            except Exception:
                continue
            if g.is_empty:
                continue
            if not g.is_valid:
                g = g.buffer(0)
            p = feat["properties"]
            self.geoms.append(g)
            self.meta.append({
                "zone": normalize_zone(p.get(ZONE_FIELD)),
                "district": p.get(DISTRICT_FIELD),
                "state": p.get(STATE_FIELD),
                "intensity": p.get(INTENSITY_FIELD),
            })
        del gj
        self.tree = STRtree(self.geoms)

    def lookup(self, lat: float, lon: float) -> Optional[dict]:
        """{'zone','district','state','intensity','boundary_case'} or None."""
        from shapely.geometry import Point
        pt = Point(lon, lat)  # shapely is (x=lon, y=lat)
        idxs = self.tree.query(pt)
        hits = [int(i) for i in idxs if self.geoms[int(i)].covers(pt)]
        if not hits:
            return None
        # Conservative: on a shared boundary between different zones, return the higher.
        best = max(hits, key=lambda i: ZONE_RANK.get(self.meta[i]["zone"] or "", 0))
        result = dict(self.meta[best])
        result["boundary_case"] = len({self.meta[i]["zone"] for i in hits}) > 1
        return result


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
