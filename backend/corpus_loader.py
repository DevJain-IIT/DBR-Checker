"""
corpus_loader.py

The provided checker_core.Corpus opens JSON files with the platform default
encoding. On Windows that's cp1252, which fails to decode the legitimate
engineering Unicode in several corpus files (<=, >=, ->, beta, gamma, degree,
en-dash...). Corpus swallows the error and silently drops the file, leaving
those clauses' citation text empty.

UTF8Corpus is a thin subclass that re-indexes with explicit UTF-8 decoding.
It does NOT modify checker_core.py or any check logic — it only fixes how the
clause JSON is read off disk, so every code's clause text is available to the
citation drawer regardless of host OS.
"""
from __future__ import annotations

import glob
import json
import os
from typing import Any

from checker_core import Corpus


class UTF8Corpus(Corpus):
    def __init__(self, corpus_dir: str):
        # Skip the parent's encoding-naive loop; do our own UTF-8 read.
        self.dir = corpus_dir
        self.files: dict[str, Any] = {}
        self.by_id: dict[str, Any] = {}
        for path in glob.glob(os.path.join(corpus_dir, "*.json")):
            name = os.path.basename(path)
            try:
                with open(path, encoding="utf-8") as fh:
                    data = json.load(fh)
            except Exception:
                # Last-ditch fallback so one malformed file can't blank the corpus.
                try:
                    with open(path, encoding="utf-8-sig") as fh:
                        data = json.load(fh)
                except Exception:
                    continue
            self.files[name] = data
            for obj in data.get("clauses", []):
                if isinstance(obj, dict) and "id" in obj:
                    self.by_id[obj["id"]] = obj
