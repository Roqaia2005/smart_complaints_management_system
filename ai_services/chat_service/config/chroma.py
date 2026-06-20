import chromadb
from chromadb.config import Settings
from dotenv import load_dotenv
import os

load_dotenv()

CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_store")

# persistent local ChromaDB client
chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)

# one collection per purpose
def get_complaints_collection():
    return chroma_client.get_or_create_collection(
        name="resolved_complaints",
        metadata={"hnsw:space": "cosine"}
    )