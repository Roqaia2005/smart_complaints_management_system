from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import json


async def create_session(db: AsyncSession, user_id: int) -> int:
    empty_state = json.dumps({
        "category_id": None,
        "category_name": None,
        "problem_summary": None,
        "details": {}
    })
    result = await db.execute(
        text('''
            INSERT INTO "ChatSessions" (user_id, status, language, collected_data, "createdAt", "updatedAt")
            VALUES (:uid, 'active', 'en', :state, NOW(), NOW())
            RETURNING id
        '''),
        {"uid": user_id, "state": empty_state}
    )
    await db.commit()
    # scalar_one() returns the single returned scalar (id) or raises if none/multiple
    return result.scalar_one()


async def save_message(db: AsyncSession, session_id: int, role: str, content: str):
    await db.execute(
        text('''
            INSERT INTO "ChatMessages" (session_id, role, content, "createdAt")
            VALUES (:sid, :role, :content, NOW())
        '''),
        {"sid": session_id, "role": role, "content": content}
    )
    await db.commit()


async def get_history(db: AsyncSession, session_id: int) -> list[dict]:
    result = await db.execute(
        text('''
            SELECT role, content FROM "ChatMessages"
            WHERE session_id = :sid ORDER BY "createdAt" ASC
        '''),
        {"sid": session_id}
    )
    return [{"role": row.role, "content": row.content} for row in result.fetchall()]


async def close_session(db: AsyncSession, session_id: int):
    await db.execute(
        text('UPDATE "ChatSessions" SET status = \'completed\', "updatedAt" = NOW() WHERE id = :sid'),
        {"sid": session_id}
    )
    await db.commit()


async def validate_session(db: AsyncSession, session_id: int, user_id: int) -> dict | None:
    result = await db.execute(
        text('''
            SELECT id, language, collected_data FROM "ChatSessions"
            WHERE id = :sid AND user_id = :uid AND status = 'active'
        '''),
        {"sid": session_id, "uid": user_id}
    )
    row = result.fetchone()
    if not row:
        return None
    state = row.collected_data or {"category_id": None, "category_name": None, "problem_summary": None, "details": {}}
    return {"id": row.id, "language": row.language, "state": state}


async def set_session_language(db: AsyncSession, session_id: int, language: str):
    await db.execute(
        text('UPDATE "ChatSessions" SET language = :lang WHERE id = :sid'),
        {"lang": language, "sid": session_id}
    )
    await db.commit()


async def update_collected_state(db: AsyncSession, session_id: int, state: dict):
    await db.execute(
        text('UPDATE "ChatSessions" SET collected_data = :data, "updatedAt" = NOW() WHERE id = :sid'),
        {"data": json.dumps(state), "sid": session_id}
    )
    await db.commit()
