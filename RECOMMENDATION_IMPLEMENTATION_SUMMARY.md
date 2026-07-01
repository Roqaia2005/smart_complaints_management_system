# Recommendation Data Isolation - Implementation Summary

## Why We Need the Database Update

You asked: **"Why do we need to update the database?"**

### Answer: To PERSIST which faculty each recommendation belongs to

Without the database column, we have no way to:
1. **Remember** which faculty a recommendation was generated for
2. **Filter** recommendations when a manager requests them later
3. **Isolate** data between different faculties

## The Complete Flow

### 1. User Generates Recommendations (with faculty_id from user)

```python
# User is logged in with faculty_id = 5 (Faculty of Engineering)
current_user = authenticate_assistant_user(db=db, authorization=authorization)
user = db.query(User).filter(User.id == current_user.id).first()
# user.faculty_id = 5

# Pipeline runs with user's faculty_id
return run_recommendation_pipeline(db, user.faculty_id)  # faculty_id = 5
```

### 2. Pipeline Filters Complaints by Faculty

```python
def run_recommendation_pipeline(db: Session, faculty_id: int):
    # Get categories belonging to this faculty
    faculty_categories = db.query(Category.id).filter(
        Category.faculty_id == faculty_id  # Only categories for Faculty of Engineering
    ).all()
    # Returns: [(1,), (2,), (3,)] - category IDs for Engineering
    
    # Filter complaints to only those categories
    df = df[df["category_id"].isin([1, 2, 3])]
    # Now only analyzing Engineering complaints
```

### 3. Save Recommendations WITH faculty_id

```python
def save_recommendation(db, category_id, faculty_id, ...):
    rec = AiRecommendation(
        category_id = category_id,
        faculty_id = faculty_id,  # ← THIS IS WHY WE NEED THE DB COLUMN
        # ... other fields
    )
    db.add(rec)
    db.commit()
    # Now in database: recommendation #123 has faculty_id = 5
```

### 4. Later, User Requests Their Recommendations

```python
@router.get("/api/manager/recommendations")
def list_recommendations(...):
    current_user = authenticate_assistant_user(db=db, authorization=authorization)
    user = db.query(User).filter(User.id == current_user.id).first()
    # user.faculty_id = 5
    
    query = db.query(AiRecommendation)
    
    # Filter by faculty - THIS IS WHY WE NEED THE DB COLUMN
    if user and user.faculty_id:
        query = query.filter(AiRecommendation.faculty_id == user.faculty_id)
        # WHERE faculty_id = 5
    
    return query.all()
    # Returns ONLY recommendations with faculty_id = 5
```

## Without the Database Column

If we DON'T add `faculty_id` to the database:

```python
# ❌ PROBLEM: No way to filter recommendations by faculty
query = db.query(AiRecommendation)
# Returns ALL recommendations from ALL faculties
# Manager from Engineering sees Medicine recommendations!
```

## The Database Column is ESSENTIAL

### What it stores:
```sql
AiRecommendations table:
┌────┬─────────────┬────────────┬──────────────────────────────┐
│ id │ category_id │ faculty_id │ recommendation               │
├────┼─────────────┼────────────┼──────────────────────────────┤
│ 1  │ 3           │ 5          │ "Improve lab equipment..."   │
│ 2  │ 3           │ 5          │ "Add more lab sessions..."   │
│ 3  │ 7           │ 8          │ "Update medical supplies..." │
└────┴─────────────┴────────────┴──────────────────────────────┘
```

### How it's used:
```python
# Manager from Faculty 5 (Engineering) logs in
user.faculty_id = 5

# Query with filter
query = db.query(AiRecommendation).filter(
    AiRecommendation.faculty_id == 5  # ← Uses the column
)

# Returns only rows where faculty_id = 5
# Returns: rows 1 and 2 (NOT row 3)
```

## The Complete Picture

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER LOGIN                                                │
│    Manager logs in → JWT contains user_id                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. GENERATE RECOMMENDATIONS                                  │
│    - Get user.faculty_id (e.g., 5 = Engineering)            │
│    - Filter complaints by faculty categories                │
│    - Generate recommendations                                │
│    - Save with faculty_id = 5  ← NEEDS DB COLUMN            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. DATABASE STORES RECOMMENDATIONS WITH faculty_id           │
│    recommendation #1: faculty_id = 5                        │
│    recommendation #2: faculty_id = 5                        │
│    recommendation #3: faculty_id = 8 (Medicine)             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. USER REQUESTS RECOMMENDATIONS LIST                        │
│    - Get user.faculty_id = 5                                │
│    - Query: WHERE faculty_id = 5  ← USES DB COLUMN          │
│    - Returns only recommendations #1 and #2                 │
│    - Does NOT return #3 (Medicine)                          │
└─────────────────────────────────────────────────────────────┘
```

## Why We Can't Just Use the User's faculty_id at Query Time

You might ask: **"Why not just filter by user.faculty_id when querying, without storing it?"**

### Answer: Because recommendations need to remember their faculty

**Scenario without storing faculty_id:**
```python
# Day 1: Manager from Engineering generates recommendations
# Recommendations are created but have NO faculty_id
# They're just "floating" in the database

# Day 2: Manager from Medicine logs in
# Without faculty_id on recommendations, we can't filter them
# Medicine manager would see Engineering's recommendations!
```

**Scenario with faculty_id stored:**
```python
# Day 1: Manager from Engineering generates recommendations
# Recommendations saved with faculty_id = 5 (Engineering)

# Day 2: Manager from Medicine logs in
# Query: WHERE faculty_id = 8 (Medicine)
# Returns ONLY Medicine recommendations
# Engineering recommendations are properly isolated
```

## Database Migration is REQUIRED

The database column MUST be added because:

1. **Storage**: We need to permanently store which faculty owns each recommendation
2. **Filtering**: We need to query recommendations by faculty_id
3. **Isolation**: We need to ensure managers only see their faculty's data
4. **Caching**: Cache keys include faculty_id for proper isolation

## Migration SQL (One-Time Setup)

```sql
-- Add the faculty_id column
ALTER TABLE "AiRecommendations" 
ADD COLUMN faculty_id INTEGER REFERENCES faculties(id);

-- Add index for performance
CREATE INDEX idx_ai_recommendations_faculty_id 
ON "AiRecommendations"(faculty_id);

-- Optional: Backfill existing recommendations
UPDATE "AiRecommendations" rec
SET faculty_id = cat.faculty_id
FROM categories cat
WHERE rec.category_id = cat.id
AND rec.faculty_id IS NULL;
```

## Summary

**Q: Why do we need to update the database?**  
**A: To permanently store `faculty_id` on each recommendation so we can:**
- Filter recommendations by faculty when listing them
- Ensure data isolation between different faculties
- Remember which faculty generated each recommendation
- Prevent cross-faculty data leakage

**Without the DB column, data isolation is impossible!**