from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel

from config.database import get_db
from services.reroute_service import reroute_complaint

router = APIRouter(prefix="/api/complaints", tags=["complaints"])


class RerouteRequest(BaseModel):
    problem: str
    faculty_id: int


@router.post("/reroute")
async def reroute_complaint_endpoint(body: RerouteRequest, db: AsyncSession = Depends(get_db)):
    """
    Called by Node when a student submits a complaint under the Other category.
    Fetches active non-Other categories for the faculty, asks the LLM which one fits,
    and returns the result. Node uses this to update the complaint's category before saving.
    """
    result = await db.execute(
        text('''
            SELECT c.id, c.name,
                   COALESCE(
                     array_agg(ck.keyword) FILTER (WHERE ck.keyword IS NOT NULL),
                     ARRAY[]::text[]
                   ) AS keywords
            FROM categories c
            LEFT JOIN "CategoryKeywords" ck ON ck.category_id = c.id
            WHERE c.faculty_id = :fid
              AND c.is_active = true
              AND c.is_other = false
            GROUP BY c.id, c.name
            ORDER BY c.name
        '''),
        {"fid": body.faculty_id}
    )
    rows = result.fetchall()
    categories = [
        {"id": row.id, "name": row.name, "keywords": list(row.keywords or [])}
        for row in rows
    ]

    reroute_result = await reroute_complaint(body.problem, categories)
    return reroute_result