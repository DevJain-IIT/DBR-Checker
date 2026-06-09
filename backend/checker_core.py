"""
checker_core.py
Foundation for the generalised DBR compliance checker.

Design principle: checks are profile-driven. No building-specific constants live
in the logic; every threshold is either code-fixed (e.g. drift 0.004h) or looked
up from the IS-code corpus keyed by the BuildingProfile. This is what makes one
function body work for a Zone-II low-rise and a Zone-V 200 m tower alike.
"""

from __future__ import annotations
from enum import Enum
from dataclasses import dataclass, field, asdict
from typing import Optional, Any, Callable
import json
import os
import glob


# --------------------------------------------------------------------------- #
#  Verdicts & Findings
# --------------------------------------------------------------------------- #
class Verdict(str, Enum):
    PASS = "PASS"               # complies
    FLAW = "FLAW"               # violates a code requirement
    REVIEW = "REVIEW"           # cannot decide automatically (out of scope / judgement)
    MISSING = "MISSING"         # required input not present in the DBR
    NOT_APPLICABLE = "NOT_APPLICABLE"  # gate failed; check does not apply to this building


@dataclass
class Finding:
    check_id: str
    title: str
    verdict: Verdict
    summary: str
    expected: Any = None
    found: Any = None
    citation: Optional[str] = None         # e.g. "IS 16700:2023, Cl 5.5.2"
    severity: str = "medium"               # low | medium | high
    notes: list = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["verdict"] = self.verdict.value
        return d


# --------------------------------------------------------------------------- #
#  Building profile  (the generalisation driver)
# --------------------------------------------------------------------------- #
@dataclass
class BuildingProfile:
    material: Optional[str] = None            # "RC" | "steel" | "composite" | "masonry"
    structural_system: Optional[str] = None   # canonical, see SYSTEM_TO_IS16700_CATEGORY
    height_m: Optional[float] = None
    num_storeys: Optional[int] = None
    occupancy: Optional[str] = None           # NBC group letter "A".."J"
    seismic_zone: Optional[str] = None        # "II" | "III" | "IV" | "V"
    basic_wind_speed: Optional[float] = None  # Vb, m/s
    soil_type: Optional[str] = None           # "I" | "II" | "III"
    foundation_type: Optional[str] = None     # "raft" | "pile" | "piled_raft" | "isolated"
    district: Optional[str] = None
    near_fault: Optional[bool] = None         # within 10 km of seismogenic fault
    occupants: Optional[int] = None

    # ---- derived scope flags ----
    def is16700_applies(self) -> bool:
        """IS 16700:2023 scope: RC, 50 m < H <= 250 m, not near-fault, <=20000 persons."""
        if self.material and self.material.upper() != "RC":
            return False
        if self.height_m is None:
            return False
        return 50.0 < self.height_m <= 250.0

    def is16700_out_of_scope_reason(self) -> Optional[str]:
        """Why IS 16700 prescriptive checks should route to REVIEW rather than apply."""
        if self.height_m is not None and self.height_m > 250.0:
            return "Height > 250 m: outside IS 16700 prescriptive scope (Cl 1.4) -> specialist review."
        if self.near_fault:
            return "Within 10 km of a seismogenic fault: IS 16700 Cl 1.2 requires a more rigorous approach."
        if self.occupants is not None and self.occupants > 20000:
            return "Occupancy > 20000 persons: outside IS 16700 scope (Cl 1.3)."
        return None


# --------------------------------------------------------------------------- #
#  Normalized DBR data contract  (superset; extensible for model/drawing checks)
# --------------------------------------------------------------------------- #
@dataclass
class DBRData:
    profile: BuildingProfile = field(default_factory=BuildingProfile)

    # materials
    concrete_grades: dict = field(default_factory=dict)   # {"columns":50,"walls":40,"slabs":30}
    rebar_grade: Optional[str] = None                     # "Fe500D"
    cement_type: Optional[str] = None                     # "OPC 53" | "PPC" | ...

    # durability / cover
    exposure_condition: Optional[str] = None              # mild|moderate|severe|very severe|extreme
    nominal_cover_mm: dict = field(default_factory=dict)  # by element

    # seismic
    zone_factor_Z: Optional[float] = None
    importance_factor_I: Optional[float] = None
    response_reduction_R: Optional[float] = None
    fundamental_period_s: Optional[float] = None
    period_method: Optional[str] = None
    seismic_weight_LL_pct: Optional[float] = None
    drift_ratio: Optional[float] = None                   # max inter-storey drift / h
    stability_coeff_theta: Optional[float] = None
    base_shear_coeff_pct: Optional[float] = None
    analysis_method: Optional[str] = None
    irregularities: list = field(default_factory=list)

    # wind
    wind_tunnel_done: Optional[bool] = None
    wind_tunnel_decision_stated: Optional[bool] = None
    lateral_accel_ms2: Optional[float] = None
    force_coefficient_Cf: Optional[float] = None

    # loads
    load_combinations: list = field(default_factory=list)

    # foundation
    foundation_depth_m: Optional[float] = None
    fos_overturning: Optional[float] = None
    fos_sliding: Optional[float] = None
    settlement_mm: Optional[float] = None

    # admin / tools
    cited_codes: list = field(default_factory=list)       # [{"code":"IS 456","year":"2000"}]
    software_used: Optional[str] = None
    title_block: dict = field(default_factory=dict)


# --------------------------------------------------------------------------- #
#  Corpus loader
# --------------------------------------------------------------------------- #
class Corpus:
    """Loads the digitized IS-code JSON files and indexes clause/table objects by id."""
    def __init__(self, corpus_dir: str):
        self.dir = corpus_dir
        self.files: dict[str, Any] = {}
        self.by_id: dict[str, Any] = {}
        for path in glob.glob(os.path.join(corpus_dir, "*.json")):
            name = os.path.basename(path)
            try:
                data = json.load(open(path))
            except Exception:
                continue
            self.files[name] = data
            for obj in data.get("clauses", []):
                if isinstance(obj, dict) and "id" in obj:
                    self.by_id[obj["id"]] = obj

    def get(self, obj_id: str) -> Optional[dict]:
        return self.by_id.get(obj_id)

    @property
    def editions(self) -> dict:
        for d in self.files.values():
            if "current_editions" in d:
                return d
        return {}


# --------------------------------------------------------------------------- #
#  Generalisation lookups  (mirror the corpus tables; single source = corpus)
# --------------------------------------------------------------------------- #
# IS 1893:2016 Table 3 zone factor Z
ZONE_FACTOR = {"II": 0.10, "III": 0.16, "IV": 0.24, "V": 0.36}

# IS 1893:2016 Table 8 importance factor I (by occupancy intent)
IMPORTANCE_BY_OCCUPANCY = {
    "A": 1.0, "E": 1.0, "F": 1.0,            # residential / business / mercantile (general)
    "B": 1.5, "C": 1.5, "D": 1.5,            # educational / institutional / assembly (important)
    "G": 1.0, "H": 1.0, "J": 1.5,            # industrial / storage / hazardous
}

# IS 16700 Table 1: max height (m) by structural-system category and zone
IS16700_MAX_HEIGHT = {
    # category: {zone: max_height_m}   NA encoded as None
    "moment_frame":              {"V": None, "IV": None, "III": 60,  "II": 80},
    "structural_wall":           {"V": 120,  "IV": 150,  "III": 200, "II": 250},
    "wall_moment_frame":         {"V": 150,  "IV": 200,  "III": 225, "II": 250},
    "wall_perimeter_frame":      {"V": 150,  "IV": 200,  "III": 225, "II": 250},
    "wall_framed_tube":          {"V": 180,  "IV": 225,  "III": 250, "II": 250},
}

# IS 16700 Table 2: max slenderness Ht/Bt by category and zone
IS16700_MAX_SLENDERNESS = {
    "moment_frame":         {"V": None, "IV": None, "III": 4, "II": 5},
    "structural_wall":      {"V": 8, "IV": 8, "III": 8, "II": 9},
    "wall_moment_frame":    {"V": 8, "IV": 8, "III": 8, "II": 9},
    "wall_perimeter_frame": {"V": 9, "IV": 9, "III": 9, "II": 10},
    "wall_framed_tube":     {"V": 9, "IV": 9, "III": 10, "II": 10},
}

# Map free-form / canonical system names to the 5 IS 16700 Table-1 categories
SYSTEM_TO_IS16700_CATEGORY = {
    "moment_frame": "moment_frame", "smrf": "moment_frame", "omrf": "moment_frame",
    "special_moment_frame": "moment_frame",
    "structural_wall": "structural_wall", "shear_wall": "structural_wall",
    "wall": "structural_wall", "core_wall": "structural_wall",
    "dual": "wall_moment_frame", "wall_moment_frame": "wall_moment_frame",
    "wall_frame": "wall_moment_frame",
    "wall_perimeter_frame": "wall_perimeter_frame",
    "framed_tube": "wall_framed_tube", "tube": "wall_framed_tube",
    "tube_in_tube": "wall_framed_tube", "outrigger": "wall_framed_tube",
    "wall_framed_tube": "wall_framed_tube",
}

# IS 16700 Table 4: min design base shear coefficient (% W) by zone, H<=120 and H>=200
IS16700_MIN_BASE_SHEAR = {
    "le_120": {"II": 0.7, "III": 1.1, "IV": 1.6, "V": 2.4},
    "ge_200": {"II": 0.5, "III": 0.75, "IV": 1.25, "V": 1.75},
}

# IS 16700 Table 3: lateral (comfort) acceleration limit, m/s2 (only Residential & Mercantile)
ACCEL_LIMIT = {"A": 0.18, "F": 0.25, "D": 0.25}  # residential / mercantile / assembly-as-mercantile


# --------------------------------------------------------------------------- #
#  Gate helpers
# --------------------------------------------------------------------------- #
def na(check_id, title, reason) -> Finding:
    return Finding(check_id, title, Verdict.NOT_APPLICABLE, reason)

def missing(check_id, title, what, citation=None) -> Finding:
    return Finding(check_id, title, Verdict.MISSING,
                   f"DBR does not state {what}.", citation=citation, severity="high")

def review(check_id, title, reason, citation=None) -> Finding:
    return Finding(check_id, title, Verdict.REVIEW, reason, citation=citation)


def canonical_system(profile: BuildingProfile) -> Optional[str]:
    if not profile.structural_system:
        return None
    key = profile.structural_system.strip().lower().replace(" ", "_").replace("-", "_")
    return SYSTEM_TO_IS16700_CATEGORY.get(key)
