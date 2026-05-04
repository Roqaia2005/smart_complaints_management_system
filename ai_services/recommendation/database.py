"""
database.py
===========
SQLAlchemy engine, session, and base setup.
All other files import get_db and Base from here.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# -----------------------------
# Engine
# -----------------------------
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    future=True
)

# -----------------------------
# Session
# -----------------------------
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False
)

# -----------------------------
# Base Model
# -----------------------------
Base = declarative_base()


# -----------------------------
# Dependency (FastAPI)
# -----------------------------
def get_db():
    """
    Dependency injected into endpoints
    Usage: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------------
# Create Tables (DEV ONLY ⚠️)
# -----------------------------
def create_tables():
    """
    Creates tables (ONLY for development).
    ⚠️ DO NOT use in production with Supabase.
    """
    Base.metadata.create_all(bind=engine)