"""
complaints.py  (UPDATED - was routers/complaints.py in your original send)

The old /api/complaints/reroute endpoint fetched EVERY active category for
the faculty and handed all of them to the LLM. It's replaced with
/api/complaints/classify, which:

1. Fetches active categories WITH their stored embeddings (one query,
   no keyword join needed anymore -- embeddings replace keyword matching).
2. Runs the hybrid CategoryClassifier (embedding similarity -> LLM only
   for the medium-confidence band -> manual review otherwise).
3. Returns a decision the Node side can act on directly.

Update your Node call site from POST /api/complaints/reroute to
POST /api/complaints/classify (see node_integration_notes.md).
"""

import os

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from config.database import get_db
from services.category_service import get_active_categories_for_faculty
from services.embedding_service import get_embedding_service
from services.category_classifier import CategoryClassifier, CategoryCandidate
from services.llm_service import choose_category

router = APIRouter(prefix="/api/complaints", tags=["complaints"])


class ClassifyRequest(BaseModel):
    problem: str
    faculty_id: int


def get_classifier() -> CategoryClassifier:
    """Built per-request (cheap -- the embedding model itself is a
    cached singleton), so thresholds can be tuned via env vars without
    a redeploy of the classifier logic."""
    return CategoryClassifier(
        embedding_service=get_embedding_service(),
        llm_chooser=choose_category,
        high_threshold=float(os.getenv("HIGH_CONFIDENCE_THRESHOLD", "0.75")),
        medium_threshold=float(os.getenv("MEDIUM_CONFIDENCE_THRESHOLD", "0.55")),
    )


@router.post("/classify")
async def classify_complaint_endpoint(
    body: ClassifyRequest,
    db: AsyncSession = Depends(get_db),
    classifier: CategoryClassifier = Depends(get_classifier),
):
    """
    Called by Node when a student submits a complaint under the "Other"
    category. Runs the hybrid embedding + LLM pipeline and returns the
    routing decision. Node uses this to update the complaint's category
    (or flag it for manual admin review) before saving.
    """
    categories = await get_active_categories_for_faculty(db, body.faculty_id)
    candidates = [
        CategoryCandidate(
            id=c["id"],
            name=c["name"],
            description=c["description"],
            embedding=c["embedding"],
        )
        for c in categories
    ]

    result = await classifier.classify(body.problem, candidates)

    return {
        "decision": result.decision.value,          # auto_assigned | llm_assigned | manual_review
        "rerouted": result.decision.value in ("auto_assigned", "llm_assigned"),
        "category_id": result.category_id,
        "category_name": result.category_name,
        "used_llm": result.used_llm,
        "top_matches": [
            {"id": m.id, "name": m.name, "similarity": round(m.similarity, 4)}
            for m in result.top_matches
        ],
    }