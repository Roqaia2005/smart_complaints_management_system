from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import json
import logging

logger = logging.getLogger("chat_service")

SESSION_TIMEOUT_MINUTES = 30


async def create_session(db: AsyncSession, user_id: int) -> int:
    state = json.dumps({
        "category_id": None,
        "category_name": None,
        "problem_summary": None,
        "details": {},
        "awaiting_confirmation": False,
        "suggestion_offered": False,
        "offensive_count": 0,
        "questions_asked": 0,
    })
    result = await db.execute(
        text('''
            INSERT INTO "ChatSessions"
                (user_id, status, language, collected_data, "createdAt", "updatedAt")
            VALUES (:uid, 'active', 'en', :state, NOW(), NOW())
            RETURNING id
        '''),
        {"uid": user_id, "state": state}
    )
    await db.commit()
    row = result.fetchone()
    if row is None:
        raise RuntimeError("Failed to create chat session")
    return row.id


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
        text('SELECT role, content FROM "ChatMessages" WHERE session_id = :sid ORDER BY "createdAt" ASC'),
        {"sid": session_id}
    )
    return [{"role": r.role, "content": r.content} for r in result.fetchall()]


async def close_session(db: AsyncSession, session_id: int, status: str = "completed"):
    await db.execute(
        text('UPDATE "ChatSessions" SET status = :s, "updatedAt" = NOW() WHERE id = :sid'),
        {"s": status, "sid": session_id}
    )
    await db.commit()


async def validate_session(db: AsyncSession, session_id: int, user_id: int) -> dict | None:
    result = await db.execute(
        text('''
            SELECT id, language, collected_data,
                   EXTRACT(EPOCH FROM (NOW() - "updatedAt")) / 60 AS minutes_idle
            FROM "ChatSessions"
            WHERE id = :sid AND user_id = :uid AND status = 'active'
        '''),
        {"sid": session_id, "uid": user_id}
    )
    row = result.fetchone()
    if not row:
        return None
    if row.minutes_idle and row.minutes_idle > SESSION_TIMEOUT_MINUTES:
        await close_session(db, row.id, status="abandoned")
        return None
    state = row.collected_data or {}
    defaults = {
        "category_id": None, "category_name": None, "problem_summary": None,
        "details": {}, "awaiting_confirmation": False, "suggestion_offered": False,
        "offensive_count": 0, "questions_asked": 0,
    }
    for k, v in defaults.items():
        if k not in state:
            state[k] = v
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


async def count_messages(db: AsyncSession, session_id: int) -> int:
    result = await db.execute(
        text('SELECT COUNT(*) AS cnt FROM "ChatMessages" WHERE session_id = :sid'),
        {"sid": session_id}
    )
    row = result.fetchone()
    return row.cnt if row else 0


async def get_student_info(db: AsyncSession, user_id: int) -> dict:
    """
    Returns student name, department, academic_year.

    Two possible joins depending on your schema:

    OPTION A: users has a student_id foreign key pointing to Students table
        SELECT u.full_name, s.department, s.academic_year
        FROM users u LEFT JOIN "Students" s ON s.id = u.student_id
        WHERE u.id = :uid

    OPTION B: Students table has a user_id foreign key pointing to users
        SELECT u.full_name, s.department, s.academic_year
        FROM users u LEFT JOIN "Students" s ON s.user_id = u.id
        WHERE u.id = :uid

    Check your models and use the right query below. Both are written out.
    Comment out the one you do not use.
    """

    
    result = await db.execute(
        text('''
            SELECT u.full_name, s.department, s.academic_year
            FROM users u
            LEFT JOIN "Students" s ON s.id = u.student_id
            WHERE u.id = :uid LIMIT 1
        '''),
        {"uid": user_id}
    )

    row = result.fetchone()
    if not row:
        return {}
    return {
        "name": row.full_name or "",
        "department": row.department or "",
        "academic_year": str(row.academic_year) if row.academic_year else "",
    }


async def get_student_faculty_id(db: AsyncSession, user_id: int) -> int | None:
    result = await db.execute(
        text('SELECT faculty_id FROM users WHERE id = :uid LIMIT 1'),
        {"uid": user_id}
    )
    row = result.fetchone()
    return row.faculty_id if row else None


async def log_offensive_incident(
    db: AsyncSession, user_id: int, session_id: int, message: str, count: int
):
    try:
        await db.execute(
            text('''
                INSERT INTO "OffensiveMessages"
                    (user_id, session_id, message, offense_count, "createdAt")
                VALUES (:uid, :sid, :msg, :cnt, NOW())
            '''),
            {"uid": user_id, "sid": session_id, "msg": message[:1000], "cnt": count}
        )
        await db.commit()
        logger.warning(f"Offensive message #{count} logged — user {user_id} session {session_id}")
    except Exception as e:
        logger.error(f"Could not log offensive message: {e}")