"""
repair_corpus.py  (one-time data prep — does NOT touch engine logic)

`file_for_DBR.json` (IS 456 + IS 13920) shipped as pretty-printed JSON objects
concatenated with newlines but NO separating commas and NO array/clauses wrapper.
The provided Corpus loader expects `{"clauses": [ {...}, ... ]}`, so it was
silently dropping all 106 of these objects (citations for D3/D4/D5/D11/D14/D17/
D20/D23/D24 would have no clause text).

This script:
  1. inserts the missing commas between top-level objects,
  2. wraps them in {"clauses": [...]},
  3. repairs U+FFFD replacement chars (the source en-dashes/bullets that got
     mangled to '�') to plain ASCII so the UI text reads cleanly,
  4. writes back in canonical shape (keeping a .bak of the original).

Idempotent: if the file already parses as {"clauses": [...]} it is left alone.
Run from backend/:  python scripts/repair_corpus.py
"""
import json
import os
import re
import shutil

CORPUS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "corpus")
TARGET = os.path.join(CORPUS_DIR, "file_for_DBR.json")


def repair_text(s: str) -> str:
    if not isinstance(s, str):
        return s
    # Fix ONLY genuine mojibake: U+FFFD replacement chars that stood in for an
    # en-dash / bullet in the source. Legitimate engineering Unicode in clause
    # text (<= >= -> beta gamma degree etc.) is preserved as-is.
    s = s.replace(" � ", " - ")
    s = s.replace("�", "-")
    return s


def deep_repair(obj):
    if isinstance(obj, dict):
        return {k: deep_repair(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [deep_repair(v) for v in obj]
    return repair_text(obj)


def main():
    raw = open(TARGET, encoding="utf-8").read().strip()

    # Already canonical? leave it.
    try:
        existing = json.loads(raw)
        if isinstance(existing, dict) and "clauses" in existing:
            print("file_for_DBR.json already canonical — no change.")
            return
    except json.JSONDecodeError:
        pass

    # Insert missing commas between adjacent top-level objects, wrap as array.
    fixed = re.sub(r"\}\s*\{", "},{", raw)
    objects = json.loads("[" + fixed + "]")
    objects = deep_repair(objects)

    if not os.path.exists(TARGET + ".bak"):
        shutil.copy(TARGET, TARGET + ".bak")

    with open(TARGET, "w", encoding="utf-8") as f:
        json.dump({"clauses": objects}, f, ensure_ascii=False, indent=2)

    print(f"Repaired file_for_DBR.json -> {{'clauses': [...]}} with {len(objects)} objects "
          f"(backup at file_for_DBR.json.bak)")


if __name__ == "__main__":
    main()
