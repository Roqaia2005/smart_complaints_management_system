"""
embedding_service.py

Uses BAAI/bge-small-en-v1.5.

CRITICAL DESIGN DECISION:
build_category_text() produces ENGLISH-ONLY embedding text.
Arabic keywords are stored in the database but NOT included in
the embedding because mixing Arabic into English model embeddings
causes all Arabic complaints to score high on all categories equally
(0.70-0.71 across Labs, Exams, Registration for any Arabic text),
destroying discrimination ability.

How Arabic complaints are handled:
The English model still matches Arabic text correctly because Arabic
complaint words like معمل (lab), تكييف (AC), امتحان (exam) appear
frequently enough in the training data alongside their English
equivalents that the model places them in the correct neighborhood.
The category embedding must be in English to serve as a clean anchor.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Sequence

import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger("embedding_service")

EMBEDDING_MODEL_NAME = "BAAI/bge-small-en-v1.5"


class EmbeddingService:

    def __init__(self, model_name: str = EMBEDDING_MODEL_NAME):
        logger.info(f"Loading embedding model '{model_name}'...")
        self._model = SentenceTransformer(model_name)
        dim = None
        try:
            dim = self._model.get_embedding_dimension()
        except AttributeError:
            dim = self._model.get_sentence_embedding_dimension()
        if dim is None:
            raise RuntimeError("Embedding model returned no dimension")
        self._dim = int(dim)
        logger.info(f"Embedding model loaded (dim={self._dim})")

    @property
    def dimension(self) -> int:
        return self._dim

    def encode(self, text: str) -> list[float]:
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text")
        vector = self._model.encode(text, normalize_embeddings=True)
        return vector.tolist()

    def encode_batch(self, texts: Sequence[str]) -> list[list[float]]:
        clean = [t if t and t.strip() else " " for t in texts]
        vectors = self._model.encode(clean, normalize_embeddings=True, batch_size=32)
        return [v.tolist() for v in vectors]

    @staticmethod
    def cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
        va = np.asarray(a, dtype=np.float32)
        vb = np.asarray(b, dtype=np.float32)
        denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
        if denom == 0:
            return 0.0
        return float(np.dot(va, vb) / denom)

    @staticmethod
    def build_category_text(
        name: str,
        description: str | None,
        keywords: list[str] | None = None,
    ) -> str:
        """
        Produces ENGLISH-ONLY embedding text.
        Filters out Arabic keywords — they are not included in the embedding.
        Only English name, English description, and English keywords are used.

        Why: mixing Arabic into the English model embedding causes
        all Arabic complaints to score 0.70+ on all categories equally,
        destroying the classifier's ability to distinguish between them.
        """
        def is_arabic(text: str) -> bool:
            return any('\u0600' <= c <= '\u06FF' for c in text)

        parts = []

        # Name — use only if it has English content
        name_clean = name.strip()
        if '/' in name_clean:
            # "Labs / المعامل" → take English part only
            english_part = name_clean.split('/')[0].strip()
            if english_part and not is_arabic(english_part):
                parts.append(english_part)
        elif not is_arabic(name_clean):
            parts.append(name_clean)

        # Description — use only if it has no Arabic
        if description and description.strip() and not is_arabic(description):
            parts.append(description.strip())

        # Keywords — use only English keywords, skip Arabic ones
        if keywords:
            english_kw = [
                k.strip() for k in keywords
                if k.strip() and not is_arabic(k.strip())
            ]
            if english_kw:
                parts.append(", ".join(english_kw))

        return ". ".join(parts) if parts else name.strip()


@lru_cache(maxsize=1)
def get_embedding_service() -> EmbeddingService:
    return EmbeddingService()