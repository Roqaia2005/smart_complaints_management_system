import re
import logging
import fitz
from sentence_transformers import SentenceTransformer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger("chat_service")

_embedder: SentenceTransformer | None = None


def _get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        from services.similarity_service import embedder
        _embedder = embedder
    return _embedder


_AR_DIGIT = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")

_STRATEGY_1 = re.compile(
    r"(?i)(?:مادة\s*[\(（]?[\u0660-\u0669\d]+[\)）]?|\barticle\s*[\(（]?\d+[\)）]?)",
    re.UNICODE,
)


_STRATEGY_2 = re.compile(
    r"(?m)^[\s\u200f]*(?:\([\u0660-\u0669\d]+\)|[\u0660-\u0669\d]+[\.\-\)]\s)",
    re.UNICODE,
)


_STRATEGY_3 = re.compile(
    r"(?i)(?:\b(?:chapter|section)\s*[\(（]?\d+[\)）]?|(?:باب|فصل|قسم|الباب|الفصل|القسم)\s+[\u0660-\u0669\w]+)",
    re.UNICODE,
)

_RELEVANCE_AR = [
    "غياب", "حضور", "امتحان", "درجة", "درجات", "نجاح", "رسوب", "تسجيل",
    "انسحاب", "فصل", "تظلم", "اعتراض", "مقرر", "ساعة معتمدة", "معدل",
    "تقدير", "منسحب", "محروم", "إعادة", "مستوى", "فصل دراسي", "الطالب",
]
_RELEVANCE_EN = [
    "attendance", "absence", "exam", "grade", "grades", "pass", "fail",
    "registration", "withdraw", "withdrawal", "dismissal", "appeal",
    "credit", "gpa", "semester", "minimum", "maximum", "percent",
    "incomplete", "repeat", "probation", "academic", "student",
]


def _is_relevant(text: str) -> bool:
    lower = text.lower()
    return any(w in lower for w in _RELEVANCE_EN) or any(w in text for w in _RELEVANCE_AR)


def extract_text(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    # Ensure each page text is a string
    pages = [str(page.get_text("text")) for page in doc]
    doc.close()
    return "\n".join(pages)


def _split_by_pattern(text: str, pattern) -> list[dict]:
    matches = list(pattern.finditer(text))
    if not matches:
        return []
    chunks = []
    for i, match in enumerate(matches):
        line_end = text.find("\n", match.start())
        if line_end == -1:
            line_end = len(text)
        title = text[match.start():line_end].strip()
        content_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[line_end:content_end].strip()
        if len(content) < 30:
            continue
        chunks.append({"title": title, "content": content, "chunk": f"{title}\n{content}"})
    return chunks


def _sliding_window(text: str, window: int = 600, step: int = 400) -> list[dict]:
    words = text.split()
    chunks = []
    i = 0
    idx = 0
    while i < len(words):
        chunk_text = " ".join(words[i:i + window])
        chunks.append({"title": f"passage_{idx}", "content": chunk_text, "chunk": chunk_text})
        i += step
        idx += 1
    return chunks


def split_into_chunks(text: str) -> list[dict]:
    for num, pattern in enumerate([_STRATEGY_1, _STRATEGY_2, _STRATEGY_3], start=1):
        chunks = _split_by_pattern(text, pattern)
        if len(chunks) >= 3:
            logger.info(f"Regulation parser: strategy {num} produced {len(chunks)} chunks")
            return chunks
    logger.info("Regulation parser: using sliding window fallback")
    return _sliding_window(text)


def filter_relevant_chunks(chunks: list[dict]) -> list[dict]:
    relevant = [c for c in chunks if _is_relevant(c["chunk"])]
    logger.info(f"Relevance filter: kept {len(relevant)} of {len(chunks)} chunks")
    return relevant


async def save_chunks_to_db(chunks: list[dict], faculty_id: int, db: AsyncSession) -> None:
    """
    Delete old pdf_chunk rows for this faculty then insert the new ones.
    embedding_id and added_by are left null — they are optional columns.
    """
    await db.execute(
        text('DELETE FROM "Regulations" WHERE faculty_id = :fid AND type = :t'),
        {"fid": faculty_id, "t": "pdf_chunk"}
    )
    for i, chunk in enumerate(chunks):
        await db.execute(
            text('''
                INSERT INTO "Regulations"
                    (article_number, content, type, faculty_id, embedding_id, added_by, "createdAt", "updatedAt")
                VALUES
                    (:article_number, :content, :type, :faculty_id, NULL, NULL, NOW(), NOW())
            '''),
            {
                "article_number": chunk["title"][:255] if chunk["title"] else f"chunk_{i}",
                "content": chunk["chunk"],
                "type": "pdf_chunk",
                "faculty_id": faculty_id,
            }
        )
    await db.commit()
    logger.info(f"Saved {len(chunks)} regulation chunks to PostgreSQL for faculty {faculty_id}")


def index_to_chroma(chunks: list[dict], faculty_id: int, chroma_client) -> int:
    """
    Embed chunks and store in ChromaDB. Clears old entries for this faculty first.
    """
    collection = chroma_client.get_or_create_collection("faculty_regulations")
    try:
        existing = collection.get(where={"faculty_id": faculty_id})
        if existing and existing.get("ids"):
            collection.delete(ids=existing["ids"])
    except Exception as e:
        logger.warning(f"Could not clear old ChromaDB entries: {e}")
    if not chunks:
        return 0
    embedder = _get_embedder()
    texts = [c["chunk"] for c in chunks]
    embeddings = embedder.encode(texts, show_progress_bar=False).tolist()
    collection.add(
        documents=texts,
        embeddings=embeddings,
        ids=[f"reg_{faculty_id}_{i}" for i in range(len(chunks))],
        metadatas=[{"faculty_id": faculty_id, "chunk_title": c["title"]} for c in chunks],
    )
    logger.info(f"Indexed {len(chunks)} chunks in ChromaDB for faculty {faculty_id}")
    return len(chunks)


async def rebuild_chroma_from_db(db: AsyncSession, chroma_client) -> None:
    """
    Called on startup. Reads all pdf_chunk rows from PostgreSQL and rebuilds
    ChromaDB so regulations are never lost when the server restarts.
    """
    result = await db.execute(
        text('''
            SELECT faculty_id, article_number, content
            FROM "Regulations"
            WHERE type = :t
            ORDER BY faculty_id, id
        '''),
        {"t": "pdf_chunk"}
    )
    rows = result.fetchall()
    if not rows:
        logger.info("No regulation chunks in DB — ChromaDB rebuild skipped")
        return

    by_faculty: dict[int, list[dict]] = {}
    for row in rows:
        fid = row.faculty_id
        if fid not in by_faculty:
            by_faculty[fid] = []
        by_faculty[fid].append({
            "title": row.article_number,
            "content": row.content,
            "chunk": row.content,
        })

    for fid, chunks in by_faculty.items():
        index_to_chroma(chunks, fid, chroma_client)
        logger.info(f"Rebuilt ChromaDB for faculty {fid} — {len(chunks)} chunks")


def get_relevant_regulations(
    query_text: str,
    faculty_id: int,
    chroma_client,
    top_k: int = 2,
) -> list[str]:
    collection = chroma_client.get_or_create_collection("faculty_regulations")
    try:
        existing = collection.get(where={"faculty_id": faculty_id})
        if not existing or not existing.get("ids"):
            return []
        total = len(existing["ids"])
    except Exception:
        return []
    embedder = _get_embedder()
    query_embedding = embedder.encode([query_text]).tolist()[0]
    try:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, total),
            where={"faculty_id": faculty_id},
            include=["documents", "distances"],
        )
    except Exception as e:
        logger.warning(f"Regulation query failed: {e}")
        return []
    if not results or not results.get("documents") or not results["documents"][0]:
        return []
    return [
        doc for doc, dist in zip(results["documents"][0], results["distances"][0])
        if dist <= 1.2
    ]


async def process_regulation_pdf(
    pdf_bytes: bytes,
    faculty_id: int,
    chroma_client,
    db: AsyncSession,
) -> dict:
    raw_text = extract_text(pdf_bytes)
    all_chunks = split_into_chunks(raw_text)
    useful_chunks = filter_relevant_chunks(all_chunks)
    await save_chunks_to_db(useful_chunks, faculty_id, db)
    indexed = index_to_chroma(useful_chunks, faculty_id, chroma_client)
    return {
        "total_chunks_found": len(all_chunks),
        "chunks_indexed": indexed,
        "faculty_id": faculty_id,
    }