from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from triage_agent import (
    iceberg_agent,
    TipMetadata,
    TipPreferences,
    TriagePayload,
    triage_tip,
)
import uvicorn
import threading
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Iceberg Triage Agent")


class MetadataPayload(BaseModel):
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


class PreferencesPayload(BaseModel):
    category: Optional[str] = None
    organization: Optional[str] = None
    journalist_id: Optional[str] = None


class TriageRequest(BaseModel):
    tip_id: str
    metadata: MetadataPayload
    verified_human: bool
    credibility: float
    preferences: Optional[PreferencesPayload] = None


@app.post("/triage")
async def receive_tip(req: TriageRequest):
    metadata = TipMetadata(**req.metadata.model_dump())
    preferences = (
        TipPreferences(**req.preferences.model_dump()) if req.preferences else None
    )
    payload = TriagePayload(
        tip_id=req.tip_id,
        metadata=metadata,
        verified_human=req.verified_human,
        credibility=req.credibility,
        preferences=preferences,
    )
    return await triage_tip(payload)


@app.get("/health")
async def health():
    return {"status": "ok", "agent": iceberg_agent.name}


def run_agent():
    iceberg_agent.run()


if __name__ == "__main__":
    threading.Thread(target=run_agent, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=8000)
