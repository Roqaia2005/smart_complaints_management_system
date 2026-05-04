"""
main.py
=======
FastAPI app entry point.
Run with: uvicorn main:app --reload --port 8000
"""

import os
from fastapi import FastAPI
from recommendation import router as recommendation_router
from dotenv import load_dotenv

# Load environment variables
load_dotenv()




app = FastAPI(title="Complaints AI Service")


app.include_router(recommendation_router)


@app.on_event("startup")
def startup():
    print("App started - DB should be connected via SQLAlchemy")


@app.get("/")
def health_check():
    return {
        "status": "running",
        "service": "Complaints AI Service"
    }