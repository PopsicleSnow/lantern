"""ASI:One client used as the LLM behind Fetch.ai's metadata-only triage.

Cleartext NEVER reaches this module under the E2EE architecture.
Filename retained for historical reasons; the substance is ASI1 calling on metadata.
"""
import requests
import json
import os
from typing import Any

ASI1_API_URL = "https://api.asi1.ai/v1/chat/completions"


PRIORITY_FIELDS = (
    "category", "confidence", "beats", "urgency",
    "word_count", "char_count",
    "has_entities", "has_dates", "has_specifics",
    "structural_quality", "entity_count", "date_count", "money_mentions",
)


def _shape_metadata(metadata: dict) -> dict:
    return {k: metadata.get(k) for k in PRIORITY_FIELDS}


async def decide_priority(
    metadata: dict,
    verified_human: bool,
    credibility: float,
) -> dict[str, Any]:
    """Call ASI:One on metadata + trust signals only. Returns priority decision."""
    api_key = os.getenv("ASI1_API_KEY")
    if not api_key:
        return _fallback_decision(metadata, verified_human, credibility)

    metadata_view = _shape_metadata(metadata)
    signals = {
        "metadata": metadata_view,
        "verified_human": verified_human,
        "credibility_score": round(credibility, 3),
    }

    prompt = f"""You are the priority router for a secure whistleblower platform.

You receive ONLY METADATA describing a tip — NEVER its content. The actual tip
text is end-to-end encrypted and only its intended journalist recipient can read it.

Your job: decide priority and urgency from the metadata + trust signals.

Signals:
{json.dumps(signals, indent=2)}

Heuristic guide:
- verified_human=true AND high structural_quality AND has_dates/has_specifics → high priority
- credibility_score >= 0.7 → boost priority one level
- credibility_score <= 0.3 → never high priority unless extremely strong signals
- low confidence OR low structural_quality → human_review urgency

Respond ONLY with valid JSON, no markdown, no preamble:
{{
  "priority": "high" | "standard",
  "urgency": "low" | "medium" | "high",
  "reasoning": "<one sentence explaining the choice, citing fields>"
}}"""

    try:
        response = requests.post(
            ASI1_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "asi1",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 200,
                "temperature": 0.1,
            },
            timeout=15,
        )
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"].strip()
        if text.startswith('```'):
            text = text.split('```')[1]
            if text.startswith('json'):
                text = text[4:]
        result = json.loads(text.strip())
        return {
            "priority": result.get("priority", "standard"),
            "urgency": result.get("urgency", metadata.get("urgency", "medium")),
            "reasoning": result.get("reasoning", ""),
        }
    except Exception as e:
        print(f"[gemma_client] ASI1 fallback: {e}")
        return _fallback_decision(metadata, verified_human, credibility)


def _fallback_decision(metadata: dict, verified_human: bool, credibility: float) -> dict[str, Any]:
    high_quality = (
        metadata.get("confidence", 0) >= 0.7
        and metadata.get("structural_quality", 0) >= 0.45
    )
    has_signal = (
        metadata.get("has_dates")
        or metadata.get("has_specifics")
        or metadata.get("money_mentions", 0) > 0
    )
    priority = (
        "high" if (verified_human and (high_quality or has_signal)) else "standard"
    )
    if credibility >= 0.7 and priority == "standard" and (high_quality or has_signal):
        priority = "high"
    if credibility <= 0.3:
        priority = "standard"

    return {
        "priority": priority,
        "urgency": metadata.get("urgency", "medium"),
        "reasoning": "rule-based fallback (ASI:One unavailable)",
    }
