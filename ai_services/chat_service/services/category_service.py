"""
category_service.py  (UPDATED)

Existing functions (get_categories_with_keywords, get_priority_rules,
get_assigned_officer) are unchanged. Added:

- get_active_categories_for_faculty(): fetches id/name/description/embedding
  for the semantic classifier. Replaces the inline query that used to live
  in complaints.py's /reroute route.
- update_category_embedding(): persists a freshly computed embedding for
  one category. Called from the new POST /api/categories/embedding route
  whenever Node creates or edits a category.
- get_categories_missing_embeddings(): used by the backfill route for
  pre-existing categories that don't have an embedding yet.

NOTE on the embedding column: pick ONE of the two implementations below
for update_category_embedding() depending on whether pgvector is available
on your Postgres instance. Both are included, with the unused one commented.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import json


async def get_categories_with_keywords(db: AsyncSession) -> list[dict]:
    # fetch all active categories
    result = await db.execute(
        text('SELECT id, name FROM categories WHERE is_active = true')
    )
    categories = result.fetchall()

    output = []
    for cat in categories:
        # fetch keywords for each category
        kw_result = await db.execute(
            text('SELECT keyword FROM "CategoryKeywords" WHERE category_id = :cid'),
            {"cid": cat.id}
        )
        keywords = [row.keyword for row in kw_result.fetchall()]
        output.append({
            "id": cat.id,
            "name": cat.name,
            "keywords": keywords
        })

    return output


async def get_priority_rules(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        text('SELECT priority_level, description FROM "PriorityRules" ORDER BY priority_level')
    )
    return [
        {"priority_level": row.priority_level, "description": row.description}
        for row in result.fetchall()
    ]


async def get_assigned_officer(db: AsyncSession, category_id: int) -> int | None:
    # find the first active officer assigned to this category
    result = await db.execute(
        text('''
            SELECT co.officer_id
            FROM "CategoryOfficers" co
            JOIN users u ON u.id = co.officer_id
            WHERE co.category_id = :cid AND u.is_active = true
            LIMIT 1
        '''),
        {"cid": category_id}
    )
    row = result.fetchone()
    return row.officer_id if row else None


async def get_active_categories_for_faculty(db: AsyncSession, faculty_id: int) -> list[dict]:
    """
    Categories eligible for semantic classification: active, non-Other,
    belonging to the faculty. Includes description + embedding so the
    classifier never needs a second round-trip to the DB.
    """
    result = await db.execute(
        text('''
            SELECT id, name, description, embedding
            FROM categories
            WHERE faculty_id = :fid
              AND is_active = true
              AND is_other = false
        '''),
        {"fid": faculty_id}
    )
    rows = result.fetchall()

    output = []
    for row in rows:
        embedding = row.embedding
        # pgvector via asyncpg often comes back as a "[0.1,0.2,...]" string
        # unless explicitly cast; JSON-column storage also returns a JSON
        # string. Normalize both to a python list here.
        if isinstance(embedding, str):
            try:
                embedding = json.loads(embedding)
            except json.JSONDecodeError:
                embedding = None
        output.append({
            "id": row.id,
            "name": row.name,
            "description": row.description,
            "embedding": embedding,
        })
    return output


async def update_category_embedding(db: AsyncSession, category_id: int, embedding: list[float]) -> None:
    """
    Persist a freshly computed embedding for a category. Called whenever
    a category is created, or its name/description is edited.
    """
    # --- Option A: pgvector column (preferred if the extension is available) ---
    await db.execute(
        text('''
            UPDATE categories
            SET embedding = CAST(:embedding AS vector)
            WHERE id = :cid
        '''),
        {"embedding": json.dumps(embedding), "cid": category_id}
    )

    # --- Option B: plain JSON column (use this instead if pgvector isn't
    # installed on your Postgres instance -- comment out Option A above
    # and uncomment this) ---
    # await db.execute(
    #     text('UPDATE categories SET embedding = :embedding WHERE id = :cid'),
    #     {"embedding": json.dumps(embedding), "cid": category_id}
    # )

    await db.commit()


async def get_categories_missing_embeddings(db: AsyncSession) -> list[dict]:
    """Used by the embedding-backfill route for categories created before
    this feature existed."""
    result = await db.execute(
        text('''
            SELECT id, name, description
            FROM categories
            WHERE embedding IS NULL AND is_active = true
        ''')
    )
    return [
        {"id": row.id, "name": row.name, "description": row.description}
        for row in result.fetchall()
    ]