from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers.chat import router as chat_router
from routers.upload import router as upload_router
from config.database import AsyncSessionLocal
from config.chroma import chroma_client
from services.similarity_service import seed_resolved_complaints
from services.regulation_service import rebuild_chroma_from_db


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers.chat import router as chat_router
from routers.upload import router as upload_router
from routers.complaints import router as complaints_router
from config.database import AsyncSessionLocal
from config.chroma import chroma_client
from services.similarity_service import seed_resolved_complaints
from services.regulation_service import rebuild_chroma_from_db
import os
import warnings


os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
warnings.filterwarnings("ignore", category=UserWarning, module="huggingface_hub")


app = FastAPI(title="University Complaint Chat Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(complaints_router)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.include_router(chat_router)


@app.on_event("startup")
async def on_startup():
    async with AsyncSessionLocal() as db:
        await seed_resolved_complaints(db)
        await rebuild_chroma_from_db(db, chroma_client)


@app.get("/health")
async def health():
    return {"status": "ok"}