"""
embedding_service.py  (NEW FILE)

Wraps a local SentenceTransformers model and exposes:
- encode(text)              -> embedding vector
- encode_batch(texts)       -> list of embedding vectors
- cosine_similarity(a, b)   -> float
- build_category_text(...)  -> canonical text used for embedding a category

The model is loaded once as a process-wide singleton (get_embedding_service)
so repeated calls don't pay the model-load cost. This module knows nothing
about the DB, HTTP, or Groq -- pure vector math -- so it can be reused later
for FAQ / knowledge-base search (requirement #12) without changes.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Sequence

import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger("embedding_service")

# BAAI/bge-small-en-v1.5 (384-dim): small, fast, strong retrieval quality.
# all-MiniLM-L6-v2 (also 384-dim): lighter/faster if you need lower latency.
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "BAAI/bge-small-en-v1.5")


class EmbeddingService:
    """Loads a SentenceTransformers model once and reuses it for all encodes."""

    def __init__(self, model_name: str = EMBEDDING_MODEL_NAME):
        logger.info(f"Loading embedding model '{model_name}'...")
        self._model = SentenceTransformer(model_name)
        self._dim = self._model.get_sentence_embedding_dimension()
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
        va, vb = np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)
        denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
        if denom == 0:
            return 0.0
        return float(np.dot(va, vb) / denom)

    @staticmethod
    def build_category_text(name: str, description: str | None) -> str:
        """Canonical text used both when embedding a category and when
        constructing what gets embedded -- keeping this in one place means
        index-time and query-time text construction can never drift apart."""
        description = (description or "").strip()
        return f"{name.strip()}. {description}" if description else name.strip()


@lru_cache(maxsize=1)
def get_embedding_service() -> EmbeddingService:
    """Process-wide singleton so the model is loaded exactly once per worker."""
    return EmbeddingService()
