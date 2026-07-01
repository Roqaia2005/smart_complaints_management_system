# AI Chat Service — University Complaint Management System

This is the Python microservice that powers the student-facing complaint chatbot. It is separate from the Node.js backend and talks to the same Supabase PostgreSQL database directly.

---

## What This Service Does

A student opens the chatbot and describes a problem in Arabic or English. This service:

1. **Detects the language** from the first message and locks it for the rest of the conversation — never mixes languages mid-chat
2. **Classifies the complaint** into the correct category using category names and keywords stored in the database — never asks the student to pick one
3. **Asks only relevant follow-up questions**, one at a time, based on the type of complaint (a broken AC needs a location; a complaint about a person needs a name, not a location) — never asks a fixed checklist, and never re-asks for something already collected
4. **Never asks "why" questions** the student can't answer (e.g. never asks "why haven't your grades been released" — that's the officer's job to find out, not the student's to explain)
5. **Searches previously resolved complaints** (via ChromaDB) for a similar issue and offers that solution before the student files a new one — but only if an AI relevance check confirms the old fix would actually help this student (a personal grade correction from someone else's case is never offered, since it can't transfer)
6. **Checks for duplicates** — if the student already has a similar complaint open or resolved (even if worded completely differently, e.g. "doctor treated me badly" vs "doctor shouted at me"), it redirects them instead of creating a second ticket
7. **Never asks the student to set a priority** — the AI determines priority itself from the complaint content after submission is confirmed
8. **Auto-submits** once enough information is gathered — completion is detected by checking whether the AI's reply still contains a question, not by trusting a self-reported flag from the model (this was a major source of bugs early on and is now handled in code)
9. **Generates a clean professional summary** for the officer, written by the AI, with no student name or ID included in the summary text itself
10. **Supports optional attachments** — a file URL (e.g. a photo of broken equipment) can be linked to the complaint at submission. The AI never looks at or analyzes the file; it is stored purely for the officer to view.
11. **Protects against abuse and failure** — message length is capped, sessions have a maximum message count, idle sessions auto-close after 30 minutes, and if the Groq API fails or times out, the student gets a graceful retry message instead of a server error.

All of this happens through two endpoints: start a session, then send messages until the complaint is either resolved by a suggestion, redirected as a duplicate, or submitted.

**What this service intentionally does NOT do:** handle appeals. If a student's complaint matches one that's already been resolved, the chatbot tells them to go to their complaints page and use the appeal feature there — appeals need to show the full resolution text and conversation history, which belongs on a detail page, not inside a chat flow.

---

## Project Structure

```
ai-service/chat/
├── .env                          # API keys and DB connection (not committed to git)
├── requirements.txt
├── main.py                       # FastAPI app entry point + startup indexing
├── config/
│   ├── database.py                # Async SQLAlchemy connection to Supabase
│   └── chroma.py                  # ChromaDB client setup
├── models/
│   └── schemas.py                 # Request/response data shapes
├── services/
│   ├── groq_client.py             # Builds the AI prompt, calls Groq, parses response
│   ├── category_service.py        # Reads categories, keywords, finds assigned officer
│   ├── complaint_service.py       # Creates the final complaint row, attaches files
│   ├── chat_service.py            # Manages chat sessions, message history, state, timeouts
│   └── similarity_service.py      # ChromaDB duplicate detection + solution suggestions
└── routers/
    └── chat.py                    # The two API endpoints + all conversation logic
```

---



## Setup Instructions

### 1. Get the code

```bash
git checkout main
git pull origin main
cd ai-service/chat
```

### 2. Create a virtual environment

```bash
python -m venv venv

# Mac/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

First run downloads a small multilingual embedding model (~470MB), cached locally afterward.

### 4. Create your `.env` file

```
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-8b-instant
CHROMA_PATH=./chroma_store
PORT=8000
```

Ask the team for the real Supabase password and Groq key. Never commit this file.

### 5. Run the service

```bash
uvicorn main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

On startup, any already-resolved complaints in the database are automatically indexed into ChromaDB so suggestions work immediately — no manual step needed.

### 6. Open the interactive API docs

`http://127.0.0.1:8000/docs` — test every endpoint without writing frontend code.

---



## API Reference

### `POST /chat/session`
Starts a new conversation.

**Body:**
```json
{ "user_id": 1 }
```
**Response:**
```json
{ "session_id": 5, "message": "Session started. How can I help you today?" }
```

---

### `POST /chat/message`
Sends a message in an existing session.

**Body:**
```json
{
  "session_id": 5,
  "user_id": 1,
  "message": "the AC is broken in lab 10",
  "attachment_url": null
}
```
- `message` is required, 1-1500 characters.
- `attachment_url` is optional - a public file URL from Supabase Storage. Only matters on the turn the complaint actually submits; it gets linked to that complaint.

**Response while still collecting info:**
```json
{
  "reply": "Could you tell me when this started?",
  "complaint_ready": false,
  "complaint_id": null,
  "collected_data": { "category_id": 1, "category_name": "Maintenance", "problem_summary": "...", "details": {} }
}
```

**Response when a duplicate is found (open or resolved):**
```json
{
  "reply": "You already have a similar complaint being processed. No need to submit again.",
  "complaint_ready": false,
  "complaint_id": 81,
  "collected_data": null
}
```
`complaint_id` here points to the *existing* complaint, so the frontend can deep-link to it.

**Response when successfully submitted:**
```json
{
  "reply": "Got it, submitting your complaint now.",
  "complaint_ready": true,
  "complaint_id": 92,
  "collected_data": {}
}
```

**Error response (expired/invalid session):**
```
404 { "detail": "Session not found or already closed." }
```
Sessions close automatically after submission, after a duplicate redirect, after 20 messages, or after 30 minutes of inactivity. On a 404, the frontend should silently call `/chat/session` again and let the student keep typing.

---

## Frontend Integration Notes

- Read `response.complaint_id` directly - never parse it out of the `reply` text.
- One `session_id` = one complaint conversation. There is no resume-after-refresh feature currently; if the page reloads mid-conversation, just start a new session.
- File uploads go straight from the frontend to Supabase Storage (`complaint-attachments` bucket) using the Supabase JS client - this service never touches the file itself, only the resulting URL.
- If a 422 comes back, the message was likely over 1500 characters - show a simple "message too long" warning.

---

## Test Cases

Run these in order using `http://127.0.0.1:8000/docs`. Restart the server before starting (`uvicorn main:app --reload --port 8000`).

### 1. Basic English complaint, full flow
1. `POST /chat/session {"user_id": 1}`
2. `"the AC is broken"` -> expect a question about location
3. `"lab 10"` -> expect a question about since-when
4. `"since Tuesday"` -> expect a closing statement with no `?`, `complaint_ready: true`, real `complaint_id`

Verify in Supabase:
```sql
SELECT id, problem, location, since, priority, status, assigned_officer_id
FROM "Complaints" ORDER BY id DESC LIMIT 1;
```

### 2. Same flow in Arabic
Repeat test 1 entirely in Arabic. Confirm every reply stays in Arabic with no English/Chinese leakage, and the AI never asks "why" something happened - only what, where, since when.

### 3. Complaint about a person (different required fields)
1. `"the math doctor shouted at me in class"` -> expect a question about which doctor/course, NOT about location
2. `"Dr. Ahmed, Calculus 2"` -> expect submission

### 4. Category does not switch mid-conversation
Walk through any complaint and confirm `collected_data.category_id` in the response stays the same value across every turn once first set.

### 5. No re-asking for already-known fields
Provide location and since-when across two messages, then check that no later question repeats either one - even if phrased differently.

### 6. Semantic duplicate detection (open complaint)
1. Submit: `"lost 2 grades in CS midterm exam despite correct answers"` -> complete it
2. New session, same user: `"there's a discrepancy in my midterm grades for the CS course"` -> complete it

Expect the second one to be caught as a duplicate, no second row created:
```sql
SELECT COUNT(*) FROM "Complaints" WHERE user_id = <id> AND category_id = <exam_category>;
```
Should be 1.

### 7. Genuinely different complaints are NOT flagged as duplicates
1. `"I have an exam conflict for Calculus on Sunday"` -> complete
2. New session: `"my physics exam was moved without notice"` -> complete

Count should be 2.

### 8. Solution suggestion - accepted
1. In Supabase, mark a complaint resolved with a transferable fix:
```sql
UPDATE "Complaints" SET status = 'resolved',
resolution_text = 'Use the backup login page at portal-backup.cu.edu.eg until the main reset system is fixed.'
WHERE id = <some_id>;
```
2. Restart the server (re-indexes on startup)
3. New session, different user: `"I can't log into the student portal, the reset password link isn't working"`
4. Expect the AI to offer the backup-link solution and ask if it resolves the issue
5. Reply `"yes that worked, thanks"`

Expect: friendly closing reply, `complaint_ready: false`, `complaint_id: null`, **no new row created.**

### 9. Solution suggestion - declined
Repeat test 8 steps 1-4, then reply `"no, still not working, please submit it"` instead. Expect it to fall through to normal collection and eventually submit with a real `complaint_id`.

### 10. Suggestion correctly withheld when not transferable
```sql
UPDATE "Complaints" SET status = 'resolved',
resolution_text = 'After review, the professor corrected this specific student grade by adding 5 marks.'
WHERE id = <some_id>;
```
Restart, then describe a similar-sounding grade complaint as a different user. This resolution should NOT be offered - it's a one-off personal fix, not something transferable.

### 11. Already-resolved duplicate -> redirect to appeal
1. Complete a complaint fully so it's `pending`
2. Manually resolve it in Supabase:
```sql
UPDATE "Complaints" SET status = 'resolved', resolution_text = 'Issue was fixed by the maintenance team.' WHERE id = <id>;
```
3. New session, same user, same kind of complaint worded differently

Expect: "already resolved, check your complaints page, you can appeal there" message, `complaint_ready: false`, `complaint_id` pointing to the resolved complaint, **no new complaint created.**

### 12. Off-topic rejection
`"what's the weather today"` -> polite refusal, `complaint_ready: false`, nothing created.

### 13. Message length cap
Send a message over 1500 characters -> expect `422` validation error.

### 14. Rate limit
Send 21 messages in a loop in one session -> the 21st should return the limit-reached message instead of calling Groq again.

### 15. Session timeout
```sql
UPDATE "ChatSessions" SET "updatedAt" = NOW() - INTERVAL '35 minutes' WHERE id = <test_id>;
```
Then try `/chat/message` on it -> expect `404`.

### 16. Groq failure resilience
Temporarily set `GROQ_API_KEY=invalid_key` in `.env`, restart, send a message -> expect a graceful fallback reply in the right language, not a server crash. Revert the key after.

### 17. Attachment linking
Submit a complaint including `"attachment_url": "https://..."` on the final message -> confirm:
```sql
SELECT * FROM "ComplaintAttachments" WHERE complaint_id = <id>;
```
Row should exist.

### 18. Invalid session
`POST /chat/message` with `session_id: 99999` -> expect `404`.

py -3.11 -m venv venv
venv\Scripts\activate
uvicorn main:app