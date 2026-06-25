"""
main.py
=======
FastAPI app entry point.
Run with: uvicorn main:app --reload --port 8000
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from recommendation import router as recommendation_router
from dss_routes import router as dss_router
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Complaints AI Service")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recommendation_router)
app.include_router(dss_router)

@app.on_event("startup")
def startup():
    print("App started - DB should be connected via SQLAlchemy")

@app.get("/")
def health_check():
    return {
        "status": "running",
        "service": "Complaints AI Service"
    }