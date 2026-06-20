from sentence_transformers import SentenceTransformer
from config.chroma import get_complaints_collection
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from groq import Groq
from dotenv import load_dotenv
import os

load_dotenv()

embedder = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

DUPLICATE_CANDIDATE_THRESHOLD = 0.45  # low bar - just rules out obviously unrelated complaints
SUGGESTION_CANDIDATE_THRESHOLD = 0.45


def embed(text_input: str) -> list[float]:
    return embedder.encode(text_input).tolist()


async def index_resolved_complaint(complaint_id: int, category_id: int, problem: str, resolution_text: str):
    collection = get_complaints_collection()
    collection.upsert(
        ids=[str(complaint_id)],
        embeddings=[embed(problem)],
        documents=[problem],
        metadatas=[{
            "complaint_id": complaint_id,
            "category_id": category_id,
            "resolution": resolution_text,
            "status": "resolved"
        }]
    )


def _cosine_similarity(a, b) -> float:
    return float(a @ b / ((sum(x**2 for x in a) ** 0.5) * (sum(x**2 for x in b) ** 0.5)))


def _is_same_complaint(problem_text: str, candidate_text: str) -> bool:
    # Embedding similarity alone is too weak for short paraphrased technical text -
    # ask the model directly whether these describe the same underlying issue
    prompt = f"""A student submitted this complaint: "{problem_text}"

The student has another open complaint already on file: "{candidate_text}"

Question: Are these two complaints describing the SAME underlying issue (even if worded differently),
or are they genuinely two different problems (even if in the same general category)?

Answer with ONLY one word: SAME or DIFFERENT."""

    response = groq_client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=5,
    )
    message_content = getattr(response.choices[0].message, "content", "") or ""
    answer = message_content.strip().upper()
    return answer.startswith("SAME")


async def find_similar_open_complaint(
    db: AsyncSession, user_id: int, category_id: int, problem_text: str
) -> dict | None:
    result = await db.execute(
        text('''
            SELECT id, problem, status FROM "Complaints"
            WHERE user_id = :uid AND category_id = :cid
            AND status IN ('pending', 'in_progress', 'appealed')
        '''),
        {"uid": user_id, "cid": category_id}
    )
    open_complaints = result.fetchall()
    if not open_complaints:
        return None

    new_embedding = embedder.encode(problem_text)

    # Rank candidates by embedding similarity first - cheap prefilter
    candidates = []
    for row in open_complaints:
        existing_embedding = embedder.encode(row.problem)
        similarity = _cosine_similarity(new_embedding, existing_embedding)
        if similarity >= DUPLICATE_CANDIDATE_THRESHOLD:
            candidates.append((similarity, row))

    candidates.sort(key=lambda x: x[0], reverse=True)

    # Confirm with the LLM for anything that passed the loose prefilter
    for similarity, row in candidates:
        if _is_same_complaint(problem_text, row.problem):
            return {"complaint_id": row.id, "status": row.status}

    return None


async def suggest_solutions(category_id: int, problem_text: str, top_k: int = 5) -> list[dict]:
    collection = get_complaints_collection()
    if collection.count() == 0:
        return []

    results = collection.query(
        query_embeddings=[embed(problem_text)],
        n_results=min(top_k, collection.count()),
        where={"category_id": category_id},
        include=["documents", "metadatas", "distances"]
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
        if similarity >= SUGGESTION_CANDIDATE_THRESHOLD:
            meta = metadatas[0][i]
            candidate_problem = documents[0][i]
            resolution_value = meta.get("resolution", "")
            resolution = str(resolution_value) if resolution_value is not None else ""

            if _is_resolution_transferable(problem_text, candidate_problem, resolution):
                suggestions.append({
                    "resolution": resolution,
                    "similarity_score": round(similarity, 2)
                })

    return suggestions[:2]


def _is_resolution_transferable(problem_text: str, candidate_problem: str, resolution: str) -> bool:
    prompt = f"""A new student has this complaint: "{problem_text}"

A past, different student had a similar-sounding complaint: "{candidate_problem}"
It was resolved with: "{resolution}"

Question: Would sharing this past resolution genuinely help the NEW student solve their problem,
or was it a fix specific only to the old case (like a personal grade change, a one-time exception,
a disciplinary action against a specific person, or anything that doesn't generalize)?

Answer with ONLY one word: YES or NO."""

    response = groq_client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=5,
    )
    message_content = getattr(response.choices[0].message, "content", "") or ""
    answer = message_content.strip().upper()
    return answer.startswith("YES")


async def seed_resolved_complaints(db: AsyncSession):
    result = await db.execute(
        text('''
            SELECT id, category_id, problem, resolution_text
            FROM "Complaints"
            WHERE status = 'resolved' AND resolution_text IS NOT NULL
        ''')
    )
    rows = result.fetchall()
    if not rows:
        return

    collection = get_complaints_collection()
    existing_ids = set(collection.get()["ids"])

    for row in rows:
        if str(row.id) not in existing_ids:
            await index_resolved_complaint(row.id, row.category_id, row.problem, row.resolution_text)