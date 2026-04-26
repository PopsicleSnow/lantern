from uagents import Agent, Context, Model, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatMessage, ChatAcknowledgement, TextContent, chat_protocol_spec
)
from gemma_client import decide_priority
from journalist_store import (
    find_matching_journalists,
    find_all_journalists,
    find_journalists_for_preferences,
)
from db import get_db
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
import os


class TipMetadata(Model):
    category: str
    confidence: float
    beats: list[str]
    urgency: str
    word_count: int
    char_count: int
    has_entities: bool
    has_dates: bool
    has_specifics: bool
    structural_quality: float
    entity_count: int
    date_count: int
    money_mentions: int


class TipPreferences(Model):
    category: Optional[str] = None
    organization: Optional[str] = None
    journalist_id: Optional[str] = None


class TriagePayload(Model):
    tip_id: str
    metadata: TipMetadata
    verified_human: bool
    credibility: float
    preferences: Optional[TipPreferences] = None


def _preferences_dict(p: Optional[TipPreferences]) -> dict:
    if p is None:
        return {}
    if hasattr(p, 'dict'):
        return {k: v for k, v in p.dict().items() if v}
    return {k: v for k, v in dict(p).items() if v}


_mailbox_env = os.getenv("AGENT_MAILBOX", "true").lower()
_mailbox_enabled = _mailbox_env not in ("false", "0", "no", "off")

lantern_agent = Agent(
    name="lantern_triage",
    network="testnet",
    seed=os.getenv("AGENT_SEED", "lantern_secret_seed_change_this"),
    mailbox=_mailbox_enabled,
    port=8001,
)

if not _mailbox_enabled:
    print("[agent] mailbox disabled (set AGENT_MAILBOX=true to enable for Agentverse)")


async def triage_tip(payload: TriagePayload) -> dict:
    """Metadata-only triage. Returns the routing decision (no DB writes)."""
    md = payload.metadata.dict() if hasattr(payload.metadata, 'dict') else dict(payload.metadata)
    prefs = _preferences_dict(payload.preferences)

    decision = await decide_priority(md, payload.verified_human, payload.credibility)
    priority = decision.get("priority", "standard")
    reasoning = decision.get("reasoning", "")

    if prefs:
        candidates = await find_journalists_for_preferences(prefs, md.get("beats", []))
    else:
        candidates = await find_matching_journalists(md.get("beats", []))
        if not candidates:
            candidates = await find_all_journalists()

    recipients = [
        {"journalist_id": str(j["_id"]), "public_key": j["public_key"]}
        for j in candidates
        if j.get("public_key")
    ]

    if recipients:
        status = "routed"
        assigned = recipients[0]["journalist_id"]
    else:
        status = "human_review"
        assigned = None

    db = get_db()
    db.tips.update_one(
        {'_id': __import__('bson').ObjectId(payload.tip_id)},
        {'$set': {
            'priority': priority,
            'classification_source': 'asi1_meta',
            'urgency': decision.get('urgency', md.get('urgency', 'medium')),
            'updated_at': datetime.now(timezone.utc),
        }}
    )

    print(f"[agent] {payload.tip_id} → {status}, priority={priority}, "
          f"recipients={len(recipients)} ({reasoning})")

    return {
        "priority": priority,
        "status": status,
        "assigned_journalist_id": assigned,
        "recipients": recipients,
        "classification_source": "asi1_meta",
        "reasoning": reasoning,
    }


def _text_reply(text: str) -> ChatMessage:
    return ChatMessage(
        msg_id=uuid4(),
        timestamp=datetime.now(timezone.utc),
        content=[TextContent(text=text)],
    )


chat_proto = Protocol(spec=chat_protocol_spec)


@chat_proto.on_message(ChatMessage, replies=None)
async def handle_chat(ctx: Context, sender: str, msg: ChatMessage):
    await ctx.send(sender, ChatAcknowledgement(
        timestamp=datetime.now(timezone.utc),
        acknowledged_msg_id=msg.msg_id,
    ))

    text = ' '.join(
        item.text for item in msg.content if isinstance(item, TextContent)
    ).lower()

    db = get_db()

    if 'review' in text or 'pending' in text:
        count = db.tips.count_documents({'status': 'human_review'})
        response = _text_reply(f"There are {count} tips awaiting human review.")
    elif 'routed' in text:
        count = db.tips.count_documents({'status': 'routed'})
        response = _text_reply(f"{count} tips have been routed to journalists.")
    elif 'total' in text or 'how many' in text:
        total = db.tips.count_documents({})
        response = _text_reply(f"Lantern has received {total} tips in total.")
    else:
        response = _text_reply(
            "Lantern Triage Agent. I route encrypted whistleblower tips to verified "
            "journalists using metadata only — I never see tip content. "
            "Try: 'review queue', 'routed tips', 'total tips'."
        )

    await ctx.send(sender, response)


@chat_proto.on_message(ChatAcknowledgement, replies=None)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


lantern_agent.include(chat_proto)
