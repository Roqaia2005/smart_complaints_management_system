"""
category_classifier.py

Three confidence zones:
  HIGH   (>= 0.62): auto-assign, zero LLM call
  MEDIUM (>= 0.48): send top-3 to LLM for final pick
  LOW    (<  0.48): manual review

Thresholds calibrated for BAAI/bge-small-en-v1.5 with
English-only category embedding text.

IMPORTANT: Category embeddings must be built from English text only.
Arabic keywords are stored in the database for display but NOT included
in the embedding text. The English model loses discrimination ability
when Arabic text is mixed into category embeddings.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Awaitable, Callable, Optional

from services.embedding_service import EmbeddingService

logger = logging.getLogger("category_classifier")


class ClassificationDecision(str, Enum):
    AUTO_ASSIGNED = "auto_assigned"
    LLM_ASSIGNED  = "llm_assigned"
    MANUAL_REVIEW = "manual_review"


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


LLMChooser = Callable[[str, list[CategoryCandidate]], Awaitable[Optional[int]]]


class CategoryClassifier:
    def __init__(
        self,
        embedding_service: EmbeddingService,
        llm_chooser: LLMChooser,
        high_threshold: float = 0.62,
        medium_threshold: float = 0.48,
        top_k: int = 3,
    ):
        if not (0 <= medium_threshold <= high_threshold <= 1):
            raise ValueError("Thresholds must satisfy 0 <= medium <= high <= 1")
        self._embed  = embedding_service
        self._llm    = llm_chooser
        self._high   = high_threshold
        self._medium = medium_threshold
        self._top_k  = top_k

    async def classify(
        self,
        complaint_text: str,
        categories: list[CategoryCandidate],
    ) -> ClassificationResult:

        # build a list of categories with non-None embeddings (narrow types for type checkers)
        cats: list[CategoryCandidate] = []
        for c in categories:
            if c.embedding is not None:
                cats.append(c)
        if not cats:
            logger.warning("No category embeddings — routing to manual review")
            return ClassificationResult(
                decision=ClassificationDecision.MANUAL_REVIEW,
                category_id=None, category_name=None,
            )

        complaint_vector = self._embed.encode(complaint_text)
        for cat in cats:
            # cat.embedding filtered above but typed as Optional; narrow for type checkers
            embedding = cat.embedding
            assert embedding is not None
            cat.similarity = self._embed.cosine_similarity(
                complaint_vector, embedding
            )

        ranked      = sorted(cats, key=lambda c: c.similarity, reverse=True)
        top_matches = ranked[: self._top_k]
        best        = top_matches[0]

        if best.similarity >= self._high:
            logger.info(f"AUTO_ASSIGNED '{best.name}' sim={best.similarity:.3f}")
            return ClassificationResult(
                decision=ClassificationDecision.AUTO_ASSIGNED,
                category_id=best.id,
                category_name=best.name,
                top_matches=top_matches,
            )

        if best.similarity >= self._medium:
            logger.info(f"MEDIUM sim={best.similarity:.3f} — asking LLM")
            chosen_id = await self._llm(complaint_text, top_matches)
            if chosen_id is not None:
                chosen = next((c for c in top_matches if c.id == chosen_id), None)
                if chosen:
                    logger.info(f"LLM_ASSIGNED '{chosen.name}'")
                    return ClassificationResult(
                        decision=ClassificationDecision.LLM_ASSIGNED,
                        category_id=chosen.id,
                        category_name=chosen.name,
                        top_matches=top_matches,
                        used_llm=True,
                    )
            return ClassificationResult(
                decision=ClassificationDecision.MANUAL_REVIEW,
                category_id=None, category_name=None,
                top_matches=top_matches, used_llm=True,
            )

        logger.info(f"LOW sim={best.similarity:.3f} — manual review")
        return ClassificationResult(
            decision=ClassificationDecision.MANUAL_REVIEW,
            category_id=None, category_name=None,
            top_matches=top_matches,
        )