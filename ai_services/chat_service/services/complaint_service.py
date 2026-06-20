from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, timezone, timedelta


async def create_complaint(
    db: AsyncSession,
    user_id: int,
    category_id: int,
    problem: str,
    location: str,
    since: str,
    ai_summary: str,
    priority: int,
    assigned_officer_id: int | None,
    sla_hours: int | None
) -> int:
    sla_deadline = None
    if sla_hours:
        sla_deadline = datetime.now(timezone.utc) + timedelta(hours=sla_hours)

    result = await db.execute(
        text('''
            INSERT INTO "Complaints"
            (user_id, category_id, problem, location, since, ai_summary,
             priority, status, assigned_officer_id, sla_deadline, "createdAt", "updatedAt")
            VALUES
            (:uid, :cid, :problem, :location, :since, :summary,
             :priority, 'pending', :officer, :sla, NOW(), NOW())
            RETURNING id
        '''),
        {
            "uid": user_id,
            "cid": category_id,
            "problem": problem,
            "location": location,
            "since": since,
            "summary": ai_summary,
            "priority": priority,
            "officer": assigned_officer_id,
            "sla": sla_deadline,
        }
    )
    await db.commit()
    row = result.fetchone()
    assert row is not None
    return row.id


async def get_sla_hours(db: AsyncSession, category_id: int) -> int | None:
    result = await db.execute(
        text('SELECT sla_hours FROM categories WHERE id = :cid'),
        {"cid": category_id}
    )
    row = result.fetchone()
    return row.sla_hours if row else None
