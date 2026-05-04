"""
database.py
===========
SQLAlchemy engine, session, and base setup.
Configured for Supabase PostgreSQL.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Supabase uses PostgreSQL — no special options needed beyond pool_pre_ping
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


def get_db():
    """
    Dependency injected into every endpoint that needs DB access.
    Usage: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """
    Creates any tables defined in models.py that don't exist yet.
    Called once on app startup from main.py.
    For Supabase, most tables already exist — this is a safety net.
    """
    Base.metadata.create_all(bind=engine)