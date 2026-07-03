"""
categories.py  (NEW FILE)

Register this router alongside your existing complaints router in your
FastAPI app (main.py): app.include_router(categories.router)

Node calls POST /api/categories/embedding right after a category is
created or its name/description is edited, so the embedding stays in
sync without Node ever touching SentenceTransformers directly.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from config.database import get_db
from services.category_service import (
    update_category_embedding,
    get_categories_missing_embeddings,
)
from services.embedding_service import get_embedding_service, EmbeddingService

router = APIRouter(prefix="/api/categories", tags=["categories"])


class EmbedCategoryRequest(BaseModel):
    category_id: int
    name: str
    description: str | None = None


@router.post("/embedding")
async def generate_category_embedding(
    body: EmbedCategoryRequest,
    db: AsyncSession = Depends(get_db),
):
    """Compute + persist the embedding for one category. Idempotent --
    safe to call on every create AND every update."""
    embedding_service = get_embedding_service()
    text_to_embed = EmbeddingService.build_category_text(body.name, body.description)
    embedding = embedding_service.encode(text_to_embed)
    await update_category_embedding(db, body.category_id, embedding)
    return {"success": True, "category_id": body.category_id, "dimension": len(embedding)}


@router.post("/embedding/backfill")
async def backfill_missing_embeddings(db: AsyncSession = Depends(get_db)):
    """One-off admin utility: embeds every active category that doesn't
    have one yet. Run this once right after the DB migration that adds
    the embedding column, to cover categories that already existed."""
    embedding_service = get_embedding_service()
    missing = await get_categories_missing_embeddings(db)
    for cat in missing:
        text_to_embed = EmbeddingService.build_category_text(cat["name"], cat["description"])
        embedding = embedding_service.encode(text_to_embed)
        await update_category_embedding(db, cat["id"], embedding)
    return {"success": True, "embedded_count": len(missing)}
