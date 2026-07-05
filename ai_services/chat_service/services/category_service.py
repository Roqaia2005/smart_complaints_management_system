"""
category_service.py

Fixed get_categories_with_keywords to filter by faculty_id.
This ensures students only see and get assigned categories
from their own faculty — never from another faculty.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import json


async def get_categories_with_keywords(
    db: AsyncSession, faculty_id: int | None = None
) -> list[dict]:
    """
    Returns active non-Other categories with their keywords.
    When faculty_id is provided (which it always should be in chat),
    only returns categories belonging to that faculty.
    """
    if faculty_id:
        result = await db.execute(
            text(
                'SELECT id, name, description FROM categories '
                'WHERE is_active = true AND is_other = false '
                'AND faculty_id = :fid'
            ),
            {"fid": faculty_id}
        )
    else:
        result = await db.execute(
            text(
                'SELECT id, name, description FROM categories '
                'WHERE is_active = true AND is_other = false'
            )
        )
    categories = result.fetchall()

    output = []
    for cat in categories:
        kw_result = await db.execute(
            text('SELECT keyword FROM "CategoryKeywords" WHERE category_id = :cid'),
            {"cid": cat.id}
        )
        keywords = [row.keyword for row in kw_result.fetchall()]
        output.append({
            "id": cat.id,
            "name": cat.name,
            "description": cat.description,
            "keywords": keywords,
        })

    return output


async def get_priority_rules(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        text(
            'SELECT priority_level, description FROM "PriorityRules" '
            'ORDER BY priority_level'
        )
    )
    return [
        {"priority_level": row.priority_level, "description": row.description}
        for row in result.fetchall()
    ]


async def get_assigned_officer(db: AsyncSession, category_id: int) -> int | None:
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


async def get_active_categories_for_faculty(
    db: AsyncSession, faculty_id: int
) -> list[dict]:
    """
    Categories eligible for semantic classification: active, non-Other,
    belonging to the faculty. Includes description + embedding.
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


async def update_category_embedding(
    db: AsyncSession, category_id: int, embedding: list[float]
) -> None:
    # Option A: pgvector column
    await db.execute(
        text('''
            UPDATE categories
            SET embedding = CAST(:embedding AS vector)
            WHERE id = :cid
        '''),
        {"embedding": json.dumps(embedding), "cid": category_id}
    )
    # Option B: plain JSON — uncomment if pgvector not available
    # await db.execute(
    #     text('UPDATE categories SET embedding = :embedding WHERE id = :cid'),
    #     {"embedding": json.dumps(embedding), "cid": category_id}
    # )
    await db.commit()


async def get_categories_missing_embeddings(db: AsyncSession) -> list[dict]:
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