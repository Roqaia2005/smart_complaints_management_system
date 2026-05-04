from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from embedding import generate_embedding, add_to_index, search_similar
from datetime import datetime, timezone
import json
import os

load_dotenv()

SIMILARITY_THRESHOLD = 0.85

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True
)

# -----------------------------
# Categories
# -----------------------------
def get_categories(faculty_id: int):
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT c.id, c.name, c.description,
                   STRING_AGG(ck.keyword, ', ') AS keywords
            FROM categories c
            LEFT JOIN categorykeywords ck ON ck.category_id = c.id
            WHERE c.faculty_id = :fid
              AND c.is_active = TRUE
              AND c.deleted_at IS NULL
            GROUP BY c.id, c.name, c.description
        """), {"fid": faculty_id})

        return [
            {
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "keywords": row["keywords"] or ""
            }
            for row in result.mappings()
        ]


# -----------------------------
# Priority Rules
# -----------------------------
def get_priority_rules():
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT priority_level, description, examples
            FROM priorityrules
            ORDER BY priority_level DESC
        """))

        return [
            {
                "level": row["priority_level"],
                "description": row["description"],
                "examples": row["examples"]
            }
            for row in result.mappings()
        ]


# -----------------------------
# Embeddings Loader (FAISS)
# -----------------------------
def load_embeddings_from_db():
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT id, embedding
            FROM complaints
            WHERE embedding IS NOT NULL
              AND deleted_at IS NULL
        """))

        complaints = []
        for row in result.mappings():
            try:
                complaints.append({
                    "id": row["id"],
                    "embedding": json.loads(row["embedding"])
                })
            except Exception:
                continue

        return complaints


# -----------------------------
# Candidate Filtering
# -----------------------------
def get_candidate_ids(user_id: int, category_id: int, status_filter: list):
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT id
            FROM complaints
            WHERE user_id = :user_id
              AND category_id = :category_id
              AND status = ANY(:statuses)
              AND deleted_at IS NULL
        """), {
            "user_id": user_id,
            "category_id": category_id,
            "statuses": status_filter
        })

        return [row["id"] for row in result.mappings()]


# -----------------------------
# Get Complaint
# -----------------------------
def get_complaint_by_id(complaint_id: int):
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT id, status, ai_summary, resolution_text, resolved_at
            FROM complaints
            WHERE id = :id
        """), {"id": complaint_id})

        row = result.mappings().fetchone()
        return dict(row) if row else None


# -----------------------------
# Duplicate Detection
# -----------------------------
def check_duplicate(user_id: int, category_id: int, problem: str):
    candidate_ids = get_candidate_ids(
        user_id,
        category_id,
        ["pending", "in_progress"]
    )

    if not candidate_ids:
        return None

    embedding = generate_embedding(problem)
    results = search_similar(embedding, candidate_ids)

    for cid, score in results:
        if score >= SIMILARITY_THRESHOLD:
            return get_complaint_by_id(cid)

    return None


# -----------------------------
# Resolved Matching
# -----------------------------
def check_resolved(user_id: int, category_id: int, problem: str):
    candidate_ids = get_candidate_ids(
        user_id,
        category_id,
        ["resolved"]
    )

    if not candidate_ids:
        return None

    embedding = generate_embedding(problem)
    results = search_similar(embedding, candidate_ids)

    if results:
        cid, score = results[0]
        return get_complaint_by_id(cid)

    return None


# -----------------------------
# Insert Complaint
# -----------------------------
def save_complaint(
    user_id: int,
    category_id: int,
    problem: str,
    location: str,
    since: str,
    ai_summary: str,
    priority: int
):
    embedding = generate_embedding(problem or "")
    embedding_json = json.dumps(embedding.tolist())

    with engine.begin() as conn:  # auto commit
        result = conn.execute(text("""
            INSERT INTO complaints (
                user_id,
                category_id,
                problem,
                location,
                since,
                ai_summary,
                priority,
                status,
                embedding,
                created_at,
                updated_at
            )
            VALUES (
                :user_id,
                :category_id,
                :problem,
                :location,
                :since,
                :ai_summary,
                :priority,
                'pending',
                :embedding,
                :now,
                :now
            )
            RETURNING id
        """), {
            "user_id": user_id,
            "category_id": category_id,
            "problem": problem,
            "location": location,
            "since": since,
            "ai_summary": ai_summary,
            "priority": priority,
            "embedding": embedding_json,
            "now": datetime.now(timezone.utc)
        })

        new_id = result.scalar()

    # Update FAISS after commit
    add_to_index(new_id, embedding)

    return new_id


# -----------------------------
# Complaint History
# -----------------------------
def add_complaint_history(complaint_id: int, status: str, changed_by: int):
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO complainthistories (
                complaint_id,
                status,
                changed_by,
                changed_at
            )
            VALUES (:cid, :status, :by, :time)
        """), {
            "cid": complaint_id,
            "status": status,
            "by": changed_by,
            "time": datetime.now(timezone.utc)
        })


# -----------------------------
# Officers
# -----------------------------
def get_officers_by_category(category_id: int):
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT u.id, u.full_name, u.email
            FROM categoryofficers co
            JOIN users u ON u.id = co.officer_id
            WHERE co.category_id = :cid
        """), {"cid": category_id})

        return [dict(row) for row in result.mappings()]