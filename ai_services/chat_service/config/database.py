from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

# DB connection string
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL is None:
    raise RuntimeError("DATABASE_URL environment variable is not set")

# build engine (that async and connect to the database)
engine = create_async_engine(DATABASE_URL, echo=False)

# session factory (that will create async sessions to interact with the database and close after finish)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# base class for our models
Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session