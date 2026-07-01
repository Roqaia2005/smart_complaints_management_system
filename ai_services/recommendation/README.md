# AI Recommendation Service

A Python FastAPI service that provides AI-powered recommendations and Decision Support System (DSS) analytics for the complaints management system.

## What It Does

- **Generates AI recommendations** based on complaint data analysis
- **Provides DSS analytics** including risk scoring, alerts, and executive summaries
- **Faculty-based data isolation** - each manager sees only their faculty's recommendations
- **Caching** - recommendations are cached for 24 hours to improve performance

## Tech Stack

- **Framework**: FastAPI
- **AI**: Groq LLM for recommendation generation
- **Analytics**: Pandas, scikit-learn (TF-IDF)
- **Database**: PostgreSQL (via SQLAlchemy)
- **Server**: Uvicorn

## Quick Start

### 1. Create virtual environment

```bash
cd ai_services/recommendation
python -m venv .venv
```

### 2. Activate virtual environment

**Windows:**
```bash
.venv\Scripts\activate
```

**Mac/Linux:**
```bash
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and add your configuration:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
GROQ_API_KEY=your_groq_api_key_here
JWT_SECRET=your_jwt_secret_here
RECOMMENDATION_CACHE_HOURS=24
```

### 5. Run database migration

**IMPORTANT**: You must add `faculty_id` columns to the database before starting:

```sql
-- Add faculty_id to users table
ALTER TABLE "users" 
ADD COLUMN faculty_id INTEGER REFERENCES faculties(id);

-- Add faculty_id to AiRecommendations table
ALTER TABLE "AiRecommendations" 
ADD COLUMN faculty_id INTEGER REFERENCES faculties(id);

-- Create indexes for performance
CREATE INDEX idx_users_faculty_id ON "users"(faculty_id);
CREATE INDEX idx_ai_recommendations_faculty_id ON "AiRecommendations"(faculty_id);
```

**Note**: If you get `AttributeError: 'User' object has no attribute 'faculty_id'`, it means you haven't run this migration yet.

### 6. Start the server

```bash
uvicorn main:app --reload --port 5000
```

The service will start at `http://127.0.0.1:5000`

## API Documentation

Once running, visit:
- **Swagger UI**: http://127.0.0.1:5000/docs
- **ReDoc**: http://127.0.0.1:5000/redoc

## Main Endpoints

### Recommendations
- `POST /api/chat/recommendations` - Generate new recommendations
- `GET /api/manager/recommendations` - List recommendations (filtered by faculty)
- `PATCH /api/manager/recommendations/{id}` - Update recommendation status

### DSS Analytics
- `GET /api/dss/dashboard` - Overall dashboard metrics
- `GET /api/dss/risk-ranking` - Category risk ranking
- `GET /api/dss/executive-summary` - Management narrative
- `GET /api/dss/alerts` - Smart alerts
- `GET /api/dss/category/{id}` - Single category insight

## Frontend Configuration

In your frontend `.env` file:

```env
VITE_RECOMMENDATION_API_URL=http://127.0.0.1:5000
```

## Project Structure

```
ai_services/recommendation/
├── main.py                 # FastAPI app entry point
├── recommendation.py       # Recommendation pipeline & endpoints
├── dss_routes.py          # DSS analytics endpoints
├── dss_analytics.py       # Analytics engine
├── models.py              # SQLAlchemy models
├── assistant/             # AI assistant module
│   ├── routes.py         # Assistant endpoints
│   ├── services/         # Assistant services
│   └── config.py         # Assistant configuration
├── .env                  # Environment variables (not in git)
├── .env.example          # Environment template
└── requirements.txt      # Python dependencies
```

## Requirements

- Python 3.8+
- PostgreSQL database
- Groq API key
- JWT secret (matching Node.js backend)

## Notes

- Recommendations are cached for 24 hours by default
- All endpoints require JWT authentication
- Data is isolated by faculty - managers only see their faculty's data
- The service runs on port 5000 by default

## Troubleshooting

**Service won't start:**
- Check that PostgreSQL is running
- Verify DATABASE_URL in `.env`
- Ensure all dependencies are installed

**Authentication errors:**
- Verify JWT_SECRET matches the Node.js backend
- Check that the user has a faculty_id assigned

**No recommendations generated:**
- Ensure there are at least 5 complaints per category
- Check that categories are assigned to a faculty
- Verify GROQ_API_KEY is valid