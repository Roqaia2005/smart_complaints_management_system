"""
classification_service.py  (NEW FILE)

Language-gated semantic classification.

English complaints → semantic classifier (87% accuracy, no LLM for clear cases)
Arabic complaints  → returns None so the LLM decides as it already does

This service is the single integration point. chat.py imports
classify_complaint() and calls it before building the system prompt.
If it returns a category_id, that is passed to the prompt as already known.
If it returns None, the LLM decides from the full category list.
"""

from __future__ import annotations

import logging
from typing import Optional

from services.embedding_service import get_embedding_service, EmbeddingService
from services.category_classifier import (
    CategoryClassifier, CategoryCandidate, ClassificationDecision,
)
from services.llm_service import choose_category

logger = logging.getLogger("classification_service")


def _is_arabic(text: str) -> bool:
    """Returns True if more than 20% of characters are Arabic Unicode."""
    if not text:
        return False
    arabic = sum(1 for c in text if '\u0600' <= c <= '\u06FF')
    return arabic > len(text) * 0.2


def _build_candidates(
    categories: list[dict],
    svc: EmbeddingService,
) -> list[CategoryCandidate]:
    """
    Convert category dicts to CategoryCandidate objects with embeddings.
    Each category dict must have: id, name, description, keywords (list).
    Embedding text is English-only — Arabic keywords are filtered out.
    """
    candidates = []
    for cat in categories:
        embedding_text = EmbeddingService.build_category_text(
            name=cat.get("name", ""),
            description=cat.get("description"),
            keywords=cat.get("keywords"),
        )
        try:
            embedding = svc.encode(embedding_text)
        except Exception as e:
            logger.warning(f"Failed to encode category {cat.get('id')}: {e}")
            embedding = None

        candidates.append(CategoryCandidate(
            id=cat["id"],
            name=cat["name"],
            description=cat.get("description"),
            embedding=embedding,
        ))
    return candidates


async def classify_complaint(
    complaint_text: str,
    categories: list[dict],
) -> Optional[dict]:
    """
    Main entry point. Call this in chat.py before building the system prompt.

    Returns:
        { "category_id": int, "category_name": str, "method": str }
        or None if the LLM should decide.

    method values:
        "semantic_auto"   — high confidence, no LLM used
        "semantic_llm"    — medium confidence, LLM confirmed from top-3
        "arabic_deferred" — Arabic complaint, LLM will decide
        "low_confidence"  — similarity too low, LLM will decide
    """
    if not categories:
        return None

    # Arabic complaints → skip classifier, defer to LLM
    if _is_arabic(complaint_text):
        logger.info("Arabic complaint detected — deferring to LLM for categorization")
        return None

    svc = get_embedding_service()
    candidates = _build_candidates(categories, svc)

    classifier = CategoryClassifier(
        embedding_service=svc,
        llm_chooser=choose_category,
        high_threshold=0.62,
        medium_threshold=0.48,
    )

    result = await classifier.classify(complaint_text, candidates)

    if result.decision == ClassificationDecision.AUTO_ASSIGNED:
        logger.info(
            f"Semantic AUTO_ASSIGNED → {result.category_name} "
            f"(no LLM call)"
        )
        return {
            "category_id":   result.category_id,
            "category_name": result.category_name,
            "method":        "semantic_auto",
        }

    if result.decision == ClassificationDecision.LLM_ASSIGNED:
        logger.info(
            f"Semantic LLM_ASSIGNED → {result.category_name} "
            f"(LLM confirmed from top-3)"
        )
        return {
            "category_id":   result.category_id,
            "category_name": result.category_name,
            "method":        "semantic_llm",
        }

    # LOW confidence or LLM returned None — let the main chat LLM decide
    logger.info("Low confidence — deferring to LLM for categorization")
    return None