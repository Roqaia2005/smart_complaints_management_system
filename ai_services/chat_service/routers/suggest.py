from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Any, cast
import json, logging, os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()
logger = logging.getLogger("suggest_router")

router = APIRouter(prefix="/api/admin/categories", tags=["admin"])
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL  = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")


class SuggestRequest(BaseModel):
    name: str
    existing_description: Optional[str] = ""


@router.post("/suggest-description")
async def suggest_category_description(body: SuggestRequest):
    """
    Called by admin dashboard when creating a new category.
    Returns a rich bilingual description and keyword suggestions.
    Admin can confirm or edit before saving.
    """
    if not body.name or not body.name.strip():
        return {"success": False, "error": "Category name is required"}

    prompt = f"""A university admin is creating a complaint category called "{body.name.strip()}".
Existing description: "{body.existing_description or ''}"

Generate a rich category description for a university complaint management system.
This description is used to automatically classify student complaints.

Requirements:
1. Write exactly 2 sentences describing what complaints belong here
2. Include specific English terms students use when describing this problem
3. Include specific Egyptian Arabic colloquial terms students use
4. Be specific — avoid generic words that apply to any category
5. Write from the student perspective — what problem are they experiencing

Return ONLY valid JSON with no text outside it:
{{
  "description_en": "Two English sentences describing the category",
  "description_ar": "جملتان بالعربية تصفان التصنيف",
  "keywords_en": ["word1", "word2", "word3", "word4", "word5"],
  "keywords_ar": ["كلمة1", "كلمة2", "كلمة3", "كلمة4", "كلمة5"]
}}"""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=cast(Any, [{"role": "user", "content": prompt}]),
            temperature=0.3,
            max_tokens=400,
        )
        raw = (response.choices[0].message.content or "").strip()
        if not raw.startswith("{"):
            brace = raw.find("{")
            if brace != -1:
                raw = raw[brace:]

        parsed  = json.loads(raw)
        desc_en = parsed.get("description_en", "")
        desc_ar = parsed.get("description_ar", "")
        kw_en   = parsed.get("keywords_en", [])
        kw_ar   = parsed.get("keywords_ar", [])

        logger.info(f"Description suggestion generated for: {body.name}")

        return {
            "success": True,
            "suggestion": {
                "description_en":       desc_en,
                "description_ar":       desc_ar,
                "keywords_en":          kw_en,
                "keywords_ar":          kw_ar,
                "combined_description": f"{desc_en} {desc_ar}".strip(),
                "combined_keywords":    ", ".join(kw_en + kw_ar),
            }
        }
    except json.JSONDecodeError:
        return {
            "success": False,
            "error": "Could not parse suggestion — please write description manually"
        }
    except Exception as e:
        logger.error(f"Suggestion failed: {e}")
        return {"success": False, "error": str(e)}