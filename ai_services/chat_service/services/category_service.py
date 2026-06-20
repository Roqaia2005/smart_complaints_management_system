from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


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