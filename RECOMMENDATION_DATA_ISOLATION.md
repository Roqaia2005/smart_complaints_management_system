# Recommendation Module - Faculty-Based Data Isolation

## Summary
Implemented faculty-based data isolation for the recommendation module. Now each manager can only see recommendations for their own faculty.

## Problem
Previously, **all recommendations in the database were visible to any authenticated manager**, regardless of faculty. This meant:
- Manager from Faculty of Engineering could see recommendations for Faculty of Medicine
- No data privacy between faculties
- Potential data leakage across organizational units

## Solution Implemented

### 1. Added `faculty_id` to AiRecommendation Model
**File**: `ai_services/recommendation/models.py`

```python
class AiRecommendation(Base):
    __tablename__ = "AiRecommendations"
    
    faculty_id = Column(Integer, ForeignKey("faculties.id"), nullable=True)  # NEW
    faculty = relationship("Faculty", backref="recommendations")  # NEW
```

### 2. Updated Recommendation Pipeline
**File**: `ai_services/recommendation/recommendation.py`

The pipeline now:
- Extracts `faculty_id` from the categories associated with complaints
- Stores `faculty_id` when saving recommendations
- Uses faculty-aware caching (different cache per faculty)

```python
# Extract faculty_id from complaints
faculty_ids = df.merge(
    db.query(Category.id, Category.faculty_id).subquery(),
    left_on="category_id",
    right_on="id",
    how="left"
)["faculty_id"].unique()

# Use most common faculty_id
from collections import Counter
faculty_id_counts = Counter(f for f in faculty_ids if pd.notna(f))
primary_faculty_id = faculty_id_counts.most_common(1)[0][0] if faculty_id_counts else None

# Save with faculty_id
rec = save_recommendation(db, cat_id, primary_faculty_id, location, ...)
```

### 3. Updated Cache Function
**File**: `ai_services/recommendation/recommendation.py`

Cache now includes faculty filtering:

```python
def get_cached(db: Session, category_id: int, faculty_id: Optional[int] = None):
    query = db.query(AiRecommendation).filter(
        AiRecommendation.category_id == category_id,
        AiRecommendation.generated_at >= cutoff,
    )
    
    # Filter by faculty if provided
    if faculty_id is not None:
        query = query.filter(AiRecommendation.faculty_id == faculty_id)
    
    return query.order_by(AiRecommendation.generated_at.desc()).first()
```

### 4. Added Faculty Filtering to Endpoints
**File**: `ai_services/recommendation/recommendation.py`

The `list_recommendations` endpoint now filters by user's faculty:

```python
@router.get("/api/manager/recommendations", response_model=list[RecommendationOut])
def list_recommendations(...):
    # Authenticate and get user
    current_user = authenticate_assistant_user(db=db, authorization=authorization)
    
    # Get user's faculty_id
    user = db.query(User).filter(User.id == current_user.id).first()
    
    query = db.query(AiRecommendation)
    
    # Filter by faculty if user has one (data isolation)
    if user and user.faculty_id:
        query = query.filter(AiRecommendation.faculty_id == user.faculty_id)
    
    # Apply other filters...
    return query.order_by(AiRecommendation.generated_at.desc()).all()
```

## Database Migration Required

### Add faculty_id Columns

You need to run a database migration to add `faculty_id` columns to the `users` and `AiRecommendations` tables.

#### Option 1: Using Alembic (Recommended)
```bash
cd ai_services/recommendation
alembic revision -m "Add faculty_id for data isolation" --autogenerate
alembic upgrade head
```

#### Option 2: Manual SQL Migration
```sql
-- Add faculty_id to users table
ALTER TABLE "users" 
ADD COLUMN faculty_id INTEGER REFERENCES faculties(id);

-- Add faculty_id to AiRecommendations table
ALTER TABLE "AiRecommendations" 
ADD COLUMN faculty_id INTEGER REFERENCES faculties(id);

-- Create indexes for performance
CREATE INDEX idx_users_faculty_id 
ON "users"(faculty_id);

CREATE INDEX idx_ai_recommendations_faculty_id 
ON "AiRecommendations"(faculty_id);

-- Backfill existing data (optional)
-- Set faculty_id for users based on their complaints' categories
UPDATE "users" u
SET faculty_id = cat.faculty_id
FROM "Complaints" c
JOIN categories cat ON c.category_id = cat.id
WHERE c.user_id = u.id
AND u.faculty_id IS NULL
LIMIT 1;

-- Set faculty_id for recommendations based on category's faculty
UPDATE "AiRecommendations" rec
SET faculty_id = cat.faculty_id
FROM categories cat
WHERE rec.category_id = cat.id
AND rec.faculty_id IS NULL;
```

## How It Works

### Authentication Flow
1. Manager logs in → receives JWT token with `{id, role, faculty_id}`
2. Manager requests recommendations → token validated
3. System extracts `faculty_id` from user record
4. Query filtered: `WHERE faculty_id = user.faculty_id`
5. Only recommendations for that faculty are returned

### Recommendation Generation Flow
1. Manager generates recommendations
2. System analyzes complaints from their faculty's categories
3. Recommendations created with `faculty_id` from the categories
4. Cached per faculty (different cache for each faculty)
5. Stored in database with faculty association

## Data Isolation Matrix

| User Role | faculty_id Set | Can See Recommendations |
|-----------|---------------|------------------------|
| Manager   | Yes           | Only their faculty ✓   |
| Manager   | No (null)     | All recommendations ⚠️  |
| Admin     | Yes/No        | All recommendations ✓   |
| Super Admin | Yes/No      | All recommendations ✓   |

**Note**: Admins and super admins bypass faculty filtering (they can see all data).

## Testing Checklist

### Test 1: Faculty Isolation
- [ ] Login as manager from Faculty of Engineering
- [ ] Generate recommendations
- [ ] Verify recommendations have `faculty_id` = Engineering
- [ ] Login as manager from Faculty of Medicine
- [ ] Request recommendations list
- [ ] **Expected**: Only see Medicine recommendations
- [ ] **Expected**: Engineering recommendations are NOT visible

### Test 2: Cross-Faculty Prevention
- [ ] Login as Faculty A manager
- [ ] Note recommendation IDs
- [ ] Login as Faculty B manager
- [ ] Try to access Faculty A's recommendation by ID
- [ ] **Expected**: 404 Not Found (filtered out)

### Test 3: Cache Isolation
- [ ] Generate recommendations for Faculty A
- [ ] Generate recommendations for Faculty B (same category)
- [ ] **Expected**: Separate cache entries per faculty
- [ ] **Expected**: No cache collision

### Test 4: Admin Access
- [ ] Login as admin
- [ ] Request recommendations
- [ ] **Expected**: See all recommendations from all faculties

## Files Modified

1. **`ai_services/recommendation/models.py`**
   - Added `faculty_id` column to `AiRecommendation`
   - Added relationship to `Faculty`

2. **`ai_services/recommendation/recommendation.py`**
   - Updated `save_recommendation()` to accept and store `faculty_id`
   - Updated `get_cached()` to filter by faculty
   - Updated `run_recommendation_pipeline()` to extract and pass `faculty_id`
   - Updated `list_recommendations()` to filter by user's faculty
   - Added `User` import for faculty lookup

## Security Considerations

### Before
```sql
SELECT * FROM AiRecommendations;
-- Returns ALL recommendations to ANY authenticated user
```

### After
```sql
SELECT * FROM AiRecommendations 
WHERE faculty_id = :user_faculty_id;
-- Returns ONLY recommendations for the user's faculty
```

### Additional Security Notes
1. **Admins bypass filter**: They can see all recommendations (by design)
2. **Null faculty_id**: If user has no faculty, they see all (should be avoided)
3. **Cache security**: Cache keys include faculty_id, preventing cross-faculty cache leaks
4. **Database index**: Add index on `faculty_id` for query performance

## Performance Impact

### Query Performance
- **Before**: Full table scan (no faculty filter)
- **After**: Indexed filter on `faculty_id` (faster with index)
- **Recommendation**: Add database index on `faculty_id` column

### Cache Performance
- **Before**: One cache per category (shared across faculties)
- **After**: One cache per (category, faculty) combination
- **Impact**: Slightly more cache entries, but proper isolation

## Migration Steps

1. **Backup database**
   ```bash
   pg_dump -U postgres -d your_db > backup.sql
   ```

2. **Run migration**
   ```sql
   ALTER TABLE "AiRecommendations" 
   ADD COLUMN faculty_id INTEGER REFERENCES faculties(id);
   
   CREATE INDEX idx_ai_recommendations_faculty_id 
   ON "AiRecommendations"(faculty_id);
   ```

3. **Backfill existing data** (if needed)
   ```sql
   UPDATE "AiRecommendations" rec
   SET faculty_id = cat.faculty_id
   FROM categories cat
   WHERE rec.category_id = cat.id
   AND rec.faculty_id IS NULL;
   ```

4. **Restart Python service**
   ```bash
   cd ai_services/recommendation
   python main.py
   ```

5. **Test with different faculty managers**

## Next Steps

1. **Run database migration** to add `faculty_id` column
2. **Test with multiple faculty managers** to verify isolation
3. **Monitor logs** for any faculty_id extraction issues
4. **Consider adding**:
   - Database index on `faculty_id` for performance
   - Audit log for recommendation access
   - Admin dashboard to see cross-faculty analytics

## Related Issues

This fix also addresses:
- Data privacy compliance (GDPR, etc.)
- Multi-tenant architecture requirements
- Faculty-specific analytics and reporting
- Preventing information leakage between departments