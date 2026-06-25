from pathlib import Path
import uuid

from fastapi import APIRouter, File, UploadFile

router = APIRouter(prefix="/upload", tags=["upload"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("")
async def upload_file(file: UploadFile = File(...)):
    extension = Path(file.filename).suffix
    filename = f"{uuid.uuid4()}{extension}"

    file_path = UPLOAD_DIR / filename

    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    return {
        "url": f"http://localhost:8000/uploads/{filename}"
    }