"""
explain.py

Optional AI layer (feature 7): turn a finding + its (deterministic) verdict +
the resolved IS-clause text into a short, plain-English explanation for the
report reader. This NEVER changes the verdict — the engine remains the source of
truth; the model only phrases *why* the existing verdict holds and what to do.

Auto-run for FLAW / MISSING findings during /api/analyze (the ones that matter).
Uses the same OpenRouter endpoint as extraction. If no API key or the call
fails, we silently skip (the finding still has its engine summary + citation).
"""
from __future__ import annotations

import os
from typing import Optional

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# A small, fast, cheap model is plenty for phrasing — overridable via env.
EXPLAIN_MODEL = os.getenv("OPENROUTER_EXPLAIN_MODEL", "anthropic/claude-haiku-4.5")

SYSTEM_PROMPT = (
    "You are a structural-engineering reviewer's assistant. You are given one "
    "compliance finding from a Design Basis Report check against Indian Standard "
    "codes: its verdict (already decided by a deterministic engine — do NOT "
    "question or change it), a one-line summary, the expected vs found values, "
    "and the relevant IS-code clause text. Write a SHORT plain-English "
    "explanation (2-4 sentences) for the engineer: what the code requires, why "
    "this finding got its verdict, and the concrete next step. Do not invent "
    "code numbers or values beyond what you are given. No preamble, no markdown "
    "headings — just the explanation."
)

# guard length of clause text we feed in
_MAX_CLAUSE = 1200


def _clause_snippets(finding: dict) -> str:
    out = []
    for c in finding.get("citations", []) or []:
        if c.get("statement"):
            label = c.get("title") or c.get("clause") or c.get("code") or ""
            out.append(f"[{c.get('code') or ''} {label}] {c['statement']}")
    text = "\n".join(out)
    return text[:_MAX_CLAUSE]


def _user_prompt(finding: dict) -> str:
    parts = [
        f"Check: {finding.get('check_id')} — {finding.get('title')}",
        f"Verdict: {finding.get('verdict')}",
        f"Summary: {finding.get('summary')}",
    ]
    if finding.get("expected") is not None:
        parts.append(f"Expected: {finding.get('expected')}")
    if finding.get("found") is not None:
        parts.append(f"Found: {finding.get('found')}")
    if finding.get("citation"):
        parts.append(f"Citation: {finding.get('citation')}")
    clause = _clause_snippets(finding)
    if clause:
        parts.append(f"Relevant IS-code clause text:\n{clause}")
    return "\n".join(parts)


async def _explain_one(client: httpx.AsyncClient, headers: dict, finding: dict) -> Optional[str]:
    payload = {
        "model": EXPLAIN_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _user_prompt(finding)},
        ],
        "temperature": 0.2,
        "max_tokens": 220,
    }
    try:
        resp = await client.post(OPENROUTER_URL, headers=headers, json=payload)
        if resp.status_code >= 400:
            return None
        content = resp.json()["choices"][0]["message"]["content"]
        if isinstance(content, list):
            content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
        return (content or "").strip() or None
    except (httpx.HTTPError, KeyError, IndexError):
        return None


async def explain_findings(findings: list[dict], verdicts: set[str] | None = None) -> None:
    """
    Mutate findings in place, adding `ai_explanation` to those whose verdict is in
    `verdicts` (default FLAW/MISSING). No-op without an API key. Best-effort: any
    individual failure just leaves that finding without an explanation.
    """
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return
    targets = verdicts or {"FLAW", "MISSING"}
    todo = [f for f in findings if f.get("verdict") in targets]
    if not todo:
        return

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.getenv("OPENROUTER_REFERER", "https://dbr-check.local"),
        "X-Title": "DBR Compliance Checker",
    }
    import asyncio

    async with httpx.AsyncClient(timeout=60.0) as client:
        results = await asyncio.gather(*[_explain_one(client, headers, f) for f in todo])
    for f, text in zip(todo, results):
        if text:
            f["ai_explanation"] = text
