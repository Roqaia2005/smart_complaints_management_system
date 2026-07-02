"""
category_classifier.py  (NEW FILE)

Pure decision logic for hybrid (embedding + LLM) complaint categorization.
Knows nothing about HTTP, SQL, or Groq -- it only deals with plain data
structures, so it can be unit-tested in isolation and reused later for
FAQ / knowledge-base matching (requirement #12) by swapping the candidate
source. The LLM call is injected as a callback (`llm_chooser`) so this
file has zero import-time dependency on llm_service / Groq.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Awaitable, Callable, Optional

from services.embedding_service import EmbeddingService

logger = logging.getLogger("category_classifier")


class ClassificationDecision(str, Enum):
    AUTO_ASSIGNED = "auto_assigned"     # top similarity >= HIGH threshold
    LLM_ASSIGNED = "llm_assigned"       # medium band, LLM picked one of top-3
    MANUAL_REVIEW = "manual_review"     # low similarity, or LLM found no match


@dataclass
class CategoryCandidate:
    id: int
    name: str
    description: Optional[str]
    embedding: Optional[list[float]] = None
    similarity: float = 0.0


@dataclass
class ClassificationResult:
    decision: ClassificationDecision
    category_id: Optional[int]
    category_name: Optional[str]
    top_matches: list[CategoryCandidate] = field(default_factory=list)
    used_llm: bool = False


# The classifier calls this to ask the LLM to pick among top-3 candidates.
# Injected so category_classifier.py never imports Groq / llm_service.
LLMChooser = Callable[[str, list[CategoryCandidate]], Awaitable[Optional[int]]]


class CategoryClassifier:
    def __init__(
        self,
        embedding_service: EmbeddingService,
        llm_chooser: LLMChooser,
        high_threshold: float = 0.75,
        medium_threshold: float = 0.55,
        top_k: int = 3,
    ):
        if not (0 <= medium_threshold <= high_threshold <= 1):
            raise ValueError("Thresholds must satisfy 0 <= medium <= high <= 1")
        self._embed = embedding_service
        self._llm_choose = llm_chooser
        self._high = high_threshold
        self._medium = medium_threshold
        self._top_k = top_k

    async def classify(
        self,
        complaint_text: str,
        categories: list[CategoryCandidate],
    ) -> ClassificationResult:
        categories_with_embeddings = [c for c in categories if c.embedding]
        if not categories_with_embeddings:
            logger.warning("No category embeddings available; routing to manual review")
            return ClassificationResult(
                decision=ClassificationDecision.MANUAL_REVIEW,
                category_id=None,
                category_name=None,
            )

        complaint_vector = self._embed.encode(complaint_text)

        for cat in categories_with_embeddings:
            cat.similarity = self._embed.cosine_similarity(complaint_vector, cat.embedding)

        ranked = sorted(categories_with_embeddings, key=lambda c: c.similarity, reverse=True)
        top_matches = ranked[: self._top_k]
        best = top_matches[0]

        # --- High confidence: auto-assign, no LLM call at all ---
        if best.similarity >= self._high:
            logger.info(f"Auto-assigned category {best.id} (sim={best.similarity:.3f})")
            return ClassificationResult(
                decision=ClassificationDecision.AUTO_ASSIGNED,
                category_id=best.id,
                category_name=best.name,
                top_matches=top_matches,
            )

        # --- Medium confidence: ask the LLM, but only about these 3 ---
        if best.similarity >= self._medium:
            logger.info(
                f"Medium confidence (sim={best.similarity:.3f}); "
                f"asking LLM to pick from top {len(top_matches)}"
            )
            chosen_id = await self._llm_choose(complaint_text, top_matches)
            if chosen_id is not None:
                chosen = next((c for c in top_matches if c.id == chosen_id), None)
                if chosen:
                    return ClassificationResult(
                        decision=ClassificationDecision.LLM_ASSIGNED,
                        category_id=chosen.id,
                        category_name=chosen.name,
                        top_matches=top_matches,
                        used_llm=True,
                    )
            logger.info("LLM found no confident match among top candidates")
            return ClassificationResult(
                decision=ClassificationDecision.MANUAL_REVIEW,
                category_id=None,
                category_name=None,
                top_matches=top_matches,
                used_llm=True,
            )

        # --- Low confidence: straight to manual review, no LLM call ---
        logger.info(f"Low confidence (sim={best.similarity:.3f}); routing to manual review")
        return ClassificationResult(
            decision=ClassificationDecision.MANUAL_REVIEW,
            category_id=None,
            category_name=None,
            top_matches=top_matches,
        )
