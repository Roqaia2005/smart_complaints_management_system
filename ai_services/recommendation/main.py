"""
Target path: main.py  (REPLACES existing file)

FastAPI app entry point.
Run with: uvicorn main:app --reload --port 5000
  or:     python main.py   (uses PORT env var, defaults to 5000)

CHANGES IN THIS VERSION
------------------------
1. Removed `port=int(os.getenv("PORT", 5000))` from the FastAPI(...)
   constructor call. FastAPI/Starlette's constructor has no `port`
   parameter -- it silently absorbed it into **extra and did nothing
   with it. It was dead code giving the false impression that the app's
   port was being configured here; the port is actually controlled by
   however uvicorn is invoked (CLI flag or the __main__ block below).

2. `debug=True` was hardcoded. Hardcoding debug mode on in a service
   that will run in production is a real risk (verbose tracebacks can
   leak internals to clients). Now driven by the DEBUG env var,
   defaulting to off.

3. CORS origins were hardcoded to localhost:5173 only. If/when this is
   deployed and the frontend is served from a real domain, every request
   from it would be silently blocked by CORS -- which can look a lot
   like "nothing works" from the frontend's perspective. Now
   configurable via ASSISTANT_CORS_ORIGINS (comma-separated), defaulting
   to the same localhost origins so local dev is unaffected.

4. Added an `if __name__ == "__main__":` block so `python main.py` works
   as the module docstring always claimed, using the PORT env var.
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from recommendation import router as recommendation_router
from dss_routes import router as dss_router
from assistant.config import AUDIO_CACHE_DIR
from assistant.routes import router as assistant_router
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DEBUG = os.getenv("DEBUG", "false").strip().lower() in {"1", "true", "yes"}

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ASSISTANT_CORS_ORIGINS",
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
app.include_router(assistant_router)

AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/audio", StaticFiles(directory=str(AUDIO_CACHE_DIR)), name="assistant_audio")


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