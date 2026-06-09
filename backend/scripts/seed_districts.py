"""
seed_districts.py  (idempotent)

Load district_seismic_wind.csv into the district_locations table.

- Seismic zones are complete for all districts; basic_wind_speed is partial
  (~10%) and will be filled in over time.
- Upsert by (state, district): existing rows are updated, new ones inserted, so
  re-running after editing the CSV (or after adding wind data) is safe.
- Runs on Render build (see render.yaml / build command) and can be run locally:
      python scripts/seed_districts.py
"""
import csv
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import DistrictLocation, SessionLocal, init_db  # noqa: E402

CSV_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "district_seismic_wind.csv",
)


def _norm(s: str) -> str:
    return (s or "").strip()


def _zone(s: str):
    s = _norm(s).upper()
    return s if s in {"II", "III", "IV", "V"} else None


def _wind(s: str):
    s = _norm(s)
    try:
        return float(s) if s else None
    except ValueError:
        return None


def _bool(s: str) -> bool:
    return _norm(s).lower() in {"true", "1", "yes"}


def main() -> None:
    if not os.path.exists(CSV_PATH):
        print(f"seed_districts: CSV not found at {CSV_PATH} — skipping.")
        return
    init_db()
    db = SessionLocal()
    try:
        # index existing rows by (state, district) for upsert
        existing = {(r.state, r.district): r for r in db.query(DistrictLocation).all()}
        inserted = updated = 0
        with open(CSV_PATH, encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                state = _norm(row.get("STATE"))
                district = _norm(row.get("District"))
                if not state or not district:
                    continue
                values = dict(
                    state=state,
                    district=district,
                    zone_conservative=_zone(row.get("zone_conservative")),
                    zone_majority=_zone(row.get("zone_majority")),
                    zone_span=_norm(row.get("zone_span")) or None,
                    is_straddler=_bool(row.get("is_straddler")),
                    basic_wind_speed_ms=_wind(row.get("basic_wind_speed_ms")),
                    wind_source=_norm(row.get("wind_source")) or None,
                )
                obj = existing.get((state, district))
                if obj is None:
                    db.add(DistrictLocation(**values))
                    inserted += 1
                else:
                    for k, v in values.items():
                        setattr(obj, k, v)
                    updated += 1
        db.commit()
        total = db.query(DistrictLocation).count()
        with_wind = db.query(DistrictLocation).filter(
            DistrictLocation.basic_wind_speed_ms.isnot(None)).count()
        print(f"seed_districts: {inserted} inserted, {updated} updated; "
              f"{total} districts total, {with_wind} with wind speed.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
