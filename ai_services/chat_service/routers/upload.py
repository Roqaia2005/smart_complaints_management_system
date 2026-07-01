import os
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from config.database import get_db
from config.chroma import chroma_client
from services.regulation_service import process_regulation_pdf

logger = logging.getLogger("chat_service")
router = APIRouter(prefix="/api", tags=["upload"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    allowed = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Only image files allowed. Got: {file.content_type}")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    filename = f"{os.urandom(8).hex()}_{file.filename}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(contents)
    return {"url": f"/uploads/{filename}"}


@router.post("/regulations/upload")
async def upload_regulation_pdf(
    file: UploadFile = File(...),
    faculty_id: int = Form(...),
    db: AsyncSession = Depends(get_db),
):
    is_pdf = (
        file.content_type == "application/pdf"
        or (file.filename and file.filename.lower().endswith(".pdf"))
    )
    if not is_pdf:
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    pdf_bytes = await file.read()
    if len(pdf_bytes) < 100:
        raise HTTPException(status_code=400, detail="PDF appears to be empty.")
    if len(pdf_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF too large (max 10MB).")
    try:
        result = await process_regulation_pdf(pdf_bytes, faculty_id, chroma_client, db)
    except Exception as e:
        logger.error(f"Regulation PDF processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")
    return {
        "success": True,
        "total_chunks_found": result["total_chunks_found"],
        "chunks_indexed": result["chunks_indexed"],
        "faculty_id": faculty_id,
    }


@router.post("/regulations/refresh")
async def refresh_regulations():
    return {"success": True}