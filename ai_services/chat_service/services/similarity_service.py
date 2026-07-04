"""
similarity_service.py

Two functions, two distinct jobs:

find_similar_open_complaint()
  - Duplicate detection
  - Checks: same student + same category + still open
  - LLM confirms it is truly the same issue before blocking
  - Returns the existing complaint if duplicate found

suggest_solutions()
  - Past resolution suggestions
  - Checks: same category + resolved + has resolution text
  - Can be from ANY student (solutions help everyone)
  - LLM filters out personal/non-transferable resolutions
    (grade changes, one-time exceptions, disciplinary actions)
  - Only shows if genuinely useful to the new student

seed_resolved_complaints()
  - Runs on startup
  - Loads all resolved complaints with resolution_text into ChromaDB
  - Indexed with faculty_id in metadata for future faculty scoping
"""

from sentence_transformers import SentenceTransformer
from config.chroma import get_complaints_collection
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from groq import Groq
from dotenv import load_dotenv
import os
import logging

load_dotenv()

logger = logging.getLogger("chat_service")

embedder = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

# Similarity threshold — complaints scoring above this are candidates
DUPLICATE_CANDIDATE_THRESHOLD = 0.45
SUGGESTION_CANDIDATE_THRESHOLD = 0.45


def embed(text_input: str) -> list[float]:
    return embedder.encode(text_input).tolist()


def _cosine_similarity(a, b) -> float:
    return float(
        a @ b / ((sum(x**2 for x in a) ** 0.5) * (sum(x**2 for x in b) ** 0.5))
    )


def _is_same_complaint(problem_text: str, candidate_text: str) -> bool:
    """
    LLM confirms whether two complaints describe the same underlying issue.
    Called only after embedding similarity already passed the threshold.
    Conservative default: if LLM fails, assume NOT duplicate so we never
    wrongly block a real complaint.
    """
    prompt = f"""A student submitted this complaint: "{problem_text}"

The same student has another open complaint already on file: "{candidate_text}"

Question: Are these two complaints describing the SAME underlying issue
(even if worded differently), or are they genuinely two different problems
(even if in the same general category)?

Answer with ONLY one word: SAME or DIFFERENT."""

    try:
        response = groq_client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=5,
        )
        content = getattr(response.choices[0].message, "content", "") or ""
        return content.strip().upper().startswith("SAME")
    except Exception as e:
        logger.error(f"Duplicate check failed, defaulting to not-duplicate: {e}")
        return False


def _is_resolution_transferable(
    problem_text: str, candidate_problem: str, resolution: str
) -> bool:
    """
    LLM decides whether a past resolution would genuinely help a NEW student.
    Filters out personal fixes (grade changes, one-time exceptions,
    disciplinary actions, anything that only worked for the original student).
    Conservative default: if LLM fails, suppress suggestion — better to
    not show a useless suggestion than show a misleading one.
    """
    prompt = f"""A new student has this complaint: "{problem_text}"

A past student had a similar complaint: "{candidate_problem}"
It was resolved with: "{resolution}"

Question: Would sharing this past resolution genuinely help the NEW student
solve their problem? Or was it a fix specific only to that old case —
such as a personal grade change, a one-time exception, a disciplinary action
against a specific person, or anything that does not generalize to other students?

Answer with ONLY one word: YES or NO."""

    try:
        response = groq_client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=5,
        )
        content = getattr(response.choices[0].message, "content", "") or ""
        return content.strip().upper().startswith("YES")
    except Exception as e:
        logger.error(f"Transferability check failed, suppressing suggestion: {e}")
        return False


async def find_similar_open_complaint(
    db: AsyncSession,
    user_id: int,
    category_id: int,
    problem_text: str,
) -> dict | None:
    """
    Duplicate detection.

    Scope:
      - Same student (user_id)
      - Same category (category_id)
      - Still open (pending / in_progress / appealed)

    Flow:
      1. Fetch all open complaints for this student in this category from DB
      2. Compute embedding similarity against each one
      3. For candidates above threshold, ask LLM to confirm same issue
      4. Return the first confirmed duplicate, or None
    """
    result = await db.execute(
        text('''
            SELECT id, problem, status
            FROM "Complaints"
            WHERE user_id  = :uid
              AND category_id = :cid
              AND status IN ('pending', 'in_progress', 'appealed')
        '''),
        {"uid": user_id, "cid": category_id}
    )
    open_complaints = result.fetchall()
    if not open_complaints:
        return None

    new_embedding = embedder.encode(problem_text)

    # Score all open complaints and collect candidates above threshold
    candidates = []
    for row in open_complaints:
        existing_embedding = embedder.encode(row.problem)
        similarity = _cosine_similarity(new_embedding, existing_embedding)
        if similarity >= DUPLICATE_CANDIDATE_THRESHOLD:
            candidates.append((similarity, row))

    # Sort best match first
    candidates.sort(key=lambda x: x[0], reverse=True)

    # LLM confirmation for each candidate
    for _, row in candidates:
        if _is_same_complaint(problem_text, row.problem):
            return {"complaint_id": row.id, "status": row.status}

    return None


async def suggest_solutions(
    category_id: int,
    problem_text: str,
    top_k: int = 5,
) -> list[dict]:
    """
    Past resolution suggestions.

    Scope:
      - Same category (category_id)
      - Resolved complaints with resolution_text (from ChromaDB)
      - ANY student — solutions can help everyone

    Flow:
      1. Search ChromaDB for semantically similar resolved complaints
         in the same category
      2. For candidates above threshold, ask LLM if the resolution
         is genuinely transferable to the new student
      3. Return up to 2 transferable resolutions

    Note: personal fixes (grade changes, one-time exceptions,
    disciplinary actions) are filtered out by the LLM.
    """
    collection = get_complaints_collection()
    if collection.count() == 0:
        return []

    results = collection.query(
        query_embeddings=[embed(problem_text)],
        n_results=min(top_k, collection.count()),
        where={"category_id": category_id},
        include=["documents", "metadatas", "distances"],
    )

    distances = results.get("distances")
    documents = results.get("documents")
    metadatas = results.get("metadatas")

    if not distances or not distances[0] or not documents or not metadatas:
        return []

    suggestions = []
    for i, distance in enumerate(distances[0]):
        if distance is None:
            continue

        similarity = 1 - distance
        if similarity < SUGGESTION_CANDIDATE_THRESHOLD:
            continue

        meta             = metadatas[0][i]
        candidate_problem = documents[0][i]
        resolution_value  = meta.get("resolution", "")
        resolution        = str(resolution_value) if resolution_value else ""

        if not resolution:
            continue

        if _is_resolution_transferable(problem_text, candidate_problem, resolution):
            suggestions.append({
                "resolution": resolution,
                "similarity_score": round(similarity, 2),
            })

    return suggestions[:2]


async def index_resolved_complaint(
    complaint_id: int,
    category_id: int,
    faculty_id: int,
    problem: str,
    resolution_text: str,
) -> None:
    """
    Index a single resolved complaint into ChromaDB.
    Stores faculty_id in metadata for future faculty-scoped queries.
    """
    collection = get_complaints_collection()
    collection.upsert(
        ids=[str(complaint_id)],
        embeddings=[embed(problem)],
        documents=[problem],
        metadatas=[{
            "complaint_id": complaint_id,
            "category_id":  category_id,
            "faculty_id":   faculty_id,
            "resolution":   resolution_text,
            "status":       "resolved",
        }]
    )


async def seed_resolved_complaints(db: AsyncSession) -> None:
    """
    Called on service startup.
    Loads all resolved complaints that have resolution_text into ChromaDB.
    Joins with categories to get faculty_id for proper metadata.
    Skips complaints already indexed.
    """
    result = await db.execute(
        text('''
            SELECT c.id, c.category_id, c.problem, c.resolution_text,
                   cat.faculty_id
            FROM "Complaints" c
            JOIN categories cat ON cat.id = c.category_id
            WHERE c.status = 'resolved'
              AND c.resolution_text IS NOT NULL
              AND c.resolution_text != ''
        ''')
    )
    rows = result.fetchall()
    if not rows:
        return

    collection   = get_complaints_collection()
    existing_ids = set(collection.get()["ids"])

    indexed_count = 0
    for row in rows:
        if str(row.id) not in existing_ids:
            await index_resolved_complaint(
                complaint_id   = row.id,
                category_id    = row.category_id,
                faculty_id     = row.faculty_id,
                problem        = row.problem,
                resolution_text= row.resolution_text,
            )
            indexed_count += 1

    if indexed_count:
        logger.info(
            f"Indexed {indexed_count} resolved complaints into ChromaDB on startup"
        )