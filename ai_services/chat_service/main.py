from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.chat import router as chat_router
from config.database import AsyncSessionLocal
from services.similarity_service import seed_resolved_complaints
from fastapi.staticfiles import StaticFiles
from routers.upload import router as upload_router
app = FastAPI(title="University Complaint Chat Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(upload_router)

app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads"
)

app.include_router(chat_router)


@app.on_event("startup")
async def index_existing_resolved_complaints():
    # Pulls any already-resolved complaints into ChromaDB so suggestions work immediately
    async with AsyncSessionLocal() as db:
        await seed_resolved_complaints(db)



@app.get("/health")
async def health():
    return {"status": "ok"}
