
import os

from config import RECOMMENDATION_ROOT
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from recommendation import router as recommendation_router
from dss_routes import router as dss_router
from briefing_routes import router as briefing_router


from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DEBUG = os.getenv("DEBUG", "false").strip().lower() in {"1", "true", "yes"}

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "RECOMMENDATION_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app = FastAPI(title="Complaints AI Service", debug=DEBUG)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recommendation_router)
app.include_router(dss_router)
app.include_router(briefing_router)

# Serve static audio files
STATIC_DIR = os.getenv("STATIC_DIR", str(RECOMMENDATION_ROOT / "static"))
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")





@app.on_event("startup")
def startup():
    print("App started - DB should be connected via SQLAlchemy")
    print(f"CORS allowed origins: {ALLOWED_ORIGINS}")
    print(f"Debug mode: {DEBUG}")


@app.get("/")
def health_check():
    return {
        "status": "running",
        "service": "Recommendation Service",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 5000)), reload=DEBUG)