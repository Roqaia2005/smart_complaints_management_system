from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.chat import router as chat_router
from config.database import AsyncSessionLocal
from services.similarity_service import seed_resolved_complaints

app = FastAPI(title="University Complaint Chat Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
