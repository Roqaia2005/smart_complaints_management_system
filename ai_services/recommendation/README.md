# Frontend Integration Guide — AI Recommendation & DSS Service

> **Audience:** Frontend developers working on the Manager dashboard and analytics pages.
> **Service:** Python FastAPI on port `8000` — the same service you already call for recommendations.

---

## TL;DR for Frontend

The Python service was upgraded from a **reporting tool** to a **Decision Support System (DSS)**. For you, this means:

1. **Existing recommendation endpoints are unchanged** — `recommendationService.ts` keeps working as-is.
2. **Five new DSS endpoints** are available for dashboards, charts, and alerts.
3. **Recommendation quality improved** — root causes are now data-driven before the AI explains them. The response shape (`Recommendation`) did **not** change.
4. **Best opportunity:** wire the new DSS APIs into `ManagerOverview`, `Analytics.tsx` (currently mock data), and `ManagerRecommendations`.

---

## Connecting from the Frontend

Your app already points at this service:

```ts
// frontend/src/api/recommendationService.ts
const RECOMMENDATION_API_URL =
  import.meta.env.VITE_RECOMMENDATION_API_URL || 'http://127.0.0.1:8000';
```

Make sure `.env` in the frontend includes:

```env
VITE_RECOMMENDATION_API_URL=http://127.0.0.1:8000
```

**CORS** is enabled for `http://localhost:5173` and `http://127.0.0.1:5173`.  
**Swagger docs** (interactive testing): [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## What Changed (Backend — Affects What You Display)

These are internal pipeline changes. **No breaking API changes** for existing endpoints, but you should understand the new behavior when presenting data to managers.

| Change | What it means for UI |
|--------|----------------------|
| **Data-driven root cause analysis** | `root_cause` on recommendations is more reliable — it prefers analytics (e.g. "60% of complaints from Library") over AI guesses. |
| **Risk scoring** | Available via new DSS endpoints. Resolved complaints are **excluded** from risk — only open cases count. |
| **Smarter AI prompt** | `pattern_detected`, `recommendation`, `urgency` are now based on analytical findings sent to the LLM. |
| **New analytical layer** | Runs before AI generation. Does not change the `Recommendation` JSON shape. |
| **New DSS module** | `dss_analytics.py` + `dss_routes.py` — powers the 5 new endpoints below. |

### Updated pipeline (simplified)

```
Fetch complaints → Translate Arabic → Statistics → DSS Analytics → Cache check
    → TF-IDF keywords → AI recommendation (explains analytics) → Save & return
```

---

## All API Endpoints

### Existing endpoints (unchanged)

These are already integrated in `frontend/src/api/recommendationService.ts`.

#### `GET /` — Health check

```json
{ "status": "running", "service": "Complaints AI Service" }
```

Use for a simple "AI service online" indicator in dev/admin tools.

---

#### `POST /api/chat/recommendations` — Generate recommendations

Runs the full pipeline. Can take **10–30+ seconds** (translation + AI per category). Show a loading state (`generating` in your store already handles this).

**Response:** `Recommendation[]`

```json
[
  {
    "id": 12,
    "category_id": 3,
    "category_name": "IT Support",
    "pattern_detected": "Recurring Wi-Fi outages reported across multiple buildings",
    "recommendation": "Deploy additional access points in the Library and audit the network backbone",
    "root_cause": "Most complaints (45%) originate from Library, indicating a localized facility or service issue.",
    "urgency": "high",
    "estimated_impact": "Should reduce repeat Wi-Fi complaints within 2 weeks",
    "location": "Library",
    "complaint_count": 18,
    "avg_resolution_h": 36,
    "appeal_rate_pct": 22,
    "top_keywords": "wifi, connection, library, network",
    "status": "pending",
    "generated_at": "2026-06-25T12:00:00",
    "createdAt": "2026-06-25T12:00:00"
  }
]
```

**Notes:**
- Returns `[]` if fewer than 5 complaints exist per category (not enough signal).
- Cached per category for 24 hours — repeat calls may return existing DB rows without re-calling AI.
- `root_cause` may now match analytical findings rather than pure AI text.

---

#### `GET /api/manager/recommendations` — List recommendations

**Query params (optional):**

| Param | Example | Description |
|-------|---------|-------------|
| `status` | `pending` | Filter: `pending`, `implemented`, `ignored` |
| `category_id` | `3` | Filter by category |

**Response:** `Recommendation[]` (same shape as above)

---

#### `PATCH /api/manager/recommendations/{id}` — Update status

**Body:**

```json
{ "status": "implemented" }
```

Allowed values: `"implemented"` | `"ignored"`

**Response:** Single `Recommendation` object.

---

### New DSS endpoints

Base path: `/api/dss`  
All are **GET** requests. They compute analytics live from the last **180 days** of complaints (up to 200 rows).  
They do **not** use the 24-hour recommendation cache.

> **Performance tip:** These endpoints run the full analytical pipeline on each request. Cache responses on the frontend (e.g. 5–15 minutes) or fetch once per page load — do not poll every few seconds.

---

#### `GET /api/dss/dashboard` — Overall dashboard KPIs

Best for: **top-level KPI cards** on Manager Overview or Analytics page.

**Response:**

```ts
interface DashboardMetrics {
  total_complaints: number;           // All complaints in analysis window
  unresolved_complaints: number;    // pending + in_progress + appealed
  resolved_complaints: number;
  overall_risk_score: number;         // 0–100, average across categories
  overall_risk_level: 'Low' | 'Medium' | 'High';
  categories_analyzed: number;      // Categories with DSS insights
  categories_above_threshold: number; // Categories with 5+ complaints
  high_priority_unresolved: number; // Open high-priority cases (priority >= 4)
  avg_appeal_rate_pct: number;
  top_hotspot_location: string;     // Most common location overall
  generated_at: string;             // ISO timestamp
}
```

**Example:**

```json
{
  "total_complaints": 87,
  "unresolved_complaints": 34,
  "resolved_complaints": 53,
  "overall_risk_score": 42.3,
  "overall_risk_level": "Medium",
  "categories_analyzed": 4,
  "categories_above_threshold": 4,
  "high_priority_unresolved": 12,
  "avg_appeal_rate_pct": 15.2,
  "top_hotspot_location": "Library",
  "generated_at": "2026-06-25T14:30:00.123456"
}
```

**UI mapping:**

| Field | Suggested component |
|-------|---------------------|
| `overall_risk_score` + `overall_risk_level` | Gauge or badge (green/amber/red) |
| `unresolved_complaints` / `total_complaints` | KPI card with progress bar |
| `high_priority_unresolved` | Alert-styled KPI card |
| `top_hotspot_location` | Map pin icon + label |

---

#### `GET /api/dss/risk-ranking` — Category risk ranking

Best for: **horizontal bar chart**, **sorted table**, or **leaderboard** showing which categories need attention first.

**Response:** `RiskRankingItem[]` sorted by `risk_score` descending (highest risk first).

```ts
interface RiskRankingItem {
  rank: number;
  category_id: number;
  category_name: string;
  risk_score: number;           // 0–100
  risk_level: 'Low' | 'Medium' | 'High';
  unresolved_count: number;
  complaint_count: number;
  appeal_rate_pct: number;
  high_priority_pct: number;
  dominant_location: string;
  hotspot_location?: string;    // Present when location is a confirmed hotspot
  hotspot_share_pct?: number;   // e.g. 45.0 means 45% of complaints
}
```

**Example:**

```json
[
  {
    "rank": 1,
    "category_id": 3,
    "category_name": "IT Support",
    "risk_score": 72.5,
    "risk_level": "High",
    "unresolved_count": 14,
    "complaint_count": 22,
    "appeal_rate_pct": 27.3,
    "high_priority_pct": 45.5,
    "dominant_location": "Library",
    "hotspot_location": "Library",
    "hotspot_share_pct": 45.0
  }
]
```

**Chart suggestion (Recharts):**

```tsx
<BarChart data={riskRanking} layout="vertical">
  <XAxis type="number" domain={[0, 100]} />
  <YAxis type="category" dataKey="category_name" width={120} />
  <Bar dataKey="risk_score" fill="#ef4444" />
</BarChart>
```

Color bars by `risk_level`: Low `#22c55e`, Medium `#f59e0b`, High `#ef4444`.

---

#### `GET /api/dss/executive-summary` — Management narrative

Best for: **hero summary panel** at the top of Overview or Recommendations page.

**Response:**

```ts
interface ExecutiveSummary {
  summary: string;              // One paragraph, data-driven (no AI)
  key_findings: string[];       // Bullet points for a list
  overall_risk_score: number;
  overall_risk_level: 'Low' | 'Medium' | 'High';
  generated_at: string;
}
```

**Example:**

```json
{
  "summary": "Analysis covers 87 complaints across 4 categories over the last 180 days. The highest operational risk is in 'IT Support' with a risk score of 72.5. There are 12 high-priority unresolved cases. Management should review 2 high-severity alerts immediately.",
  "key_findings": [
    "34 of 87 complaints remain unresolved (overall risk: Medium).",
    "Highest-risk category: IT Support (score 72.5, 14 open cases).",
    "2 high-severity alert(s) require attention.",
    "Location hotspots detected in: IT Support, Facilities."
  ],
  "overall_risk_score": 42.3,
  "overall_risk_level": "Medium",
  "generated_at": "2026-06-25T14:30:00.123456"
}
```

**UI:** Render `summary` as a paragraph; `key_findings` as a `<ul>` with alert icons.

---

#### `GET /api/dss/alerts` — Smart alerts

Best for: **alert banner**, **notification feed**, or **sidebar widget**.

**Response:** `SmartAlert[]` sorted by severity (high first).

```ts
interface SmartAlert {
  severity: 'high' | 'medium' | 'low';
  category_id: number;
  category_name: string;
  alert_type: string;   // See table below
  message: string;      // Human-readable, ready to display
  metric_value: number; // The value that triggered the alert
}
```

**Alert types:**

| `alert_type` | When it fires |
|--------------|---------------|
| `high_risk` | Category risk score ≥ 67 |
| `elevated_risk` | Category risk score 34–66 |
| `high_appeal_rate` | Appeal rate ≥ 20% |
| `high_priority_cluster` | High-priority rate ≥ 40% |
| `location_hotspot` | ≥ 40% of complaints from one location |
| `backlog` | ≥ 10 unresolved complaints in category |

**Example:**

```json
[
  {
    "severity": "high",
    "category_id": 3,
    "category_name": "IT Support",
    "alert_type": "high_risk",
    "message": "IT Support: operational risk score is 72.5 (High)",
    "metric_value": 72.5
  }
]
```

**UI suggestion:**

```tsx
const alertColors = {
  high: 'bg-rose-500/10 border-rose-500 text-rose-700',
  medium: 'bg-amber-500/10 border-amber-500 text-amber-700',
  low: 'bg-blue-500/10 border-blue-500 text-blue-700',
};
```

Link each alert to `/manager/recommendations?category_id={category_id}` or open category detail.

---

#### `GET /api/dss/category/{category_id}` — Single category insight

Best for: **drill-down panel** when a manager clicks a category in risk ranking or a recommendation card.

**Response:**

```ts
interface CategoryInsight {
  category_id: number;
  category_name: string;
  risk_score: number;
  risk_level: 'Low' | 'Medium' | 'High';
  unresolved_count: number;
  complaint_count: number;
  appeal_rate_pct: number;
  high_priority_pct: number;
  findings: string[];              // Data-driven analytical bullets
  confident_root_cause?: string;     // Verified root cause (prefer over AI if shown together)
  dominant_keywords: string[];     // From TF-IDF
}
```

**Errors:** `404` if category has fewer than 5 complaints in the analysis window.

**UI:** Show `findings` as a checklist; highlight `confident_root_cause` in a callout box. Compare with `recommendation.root_cause` from the recommendations list — they should align when analytics are confident.

---

## TypeScript Types to Add

Create `frontend/src/types/dss.ts`:

```ts
export type RiskLevel = 'Low' | 'Medium' | 'High';
export type AlertSeverity = 'high' | 'medium' | 'low';

export interface DashboardMetrics {
  total_complaints: number;
  unresolved_complaints: number;
  resolved_complaints: number;
  overall_risk_score: number;
  overall_risk_level: RiskLevel;
  categories_analyzed: number;
  categories_above_threshold: number;
  high_priority_unresolved: number;
  avg_appeal_rate_pct: number;
  top_hotspot_location: string;
  generated_at: string;
}

export interface RiskRankingItem {
  rank: number;
  category_id: number;
  category_name: string;
  risk_score: number;
  risk_level: RiskLevel;
  unresolved_count: number;
  complaint_count: number;
  appeal_rate_pct: number;
  high_priority_pct: number;
  dominant_location: string;
  hotspot_location?: string;
  hotspot_share_pct?: number;
}

export interface ExecutiveSummary {
  summary: string;
  key_findings: string[];
  overall_risk_score: number;
  overall_risk_level: RiskLevel;
  generated_at: string;
}

export interface SmartAlert {
  severity: AlertSeverity;
  category_id: number;
  category_name: string;
  alert_type: string;
  message: string;
  metric_value: number;
}

export interface CategoryInsight {
  category_id: number;
  category_name: string;
  risk_score: number;
  risk_level: RiskLevel;
  unresolved_count: number;
  complaint_count: number;
  appeal_rate_pct: number;
  high_priority_pct: number;
  findings: string[];
  confident_root_cause?: string;
  dominant_keywords: string[];
}
```

---

## API Service — Extend `recommendationService.ts`

Add DSS methods to your existing service (same base URL, same axios instance):

```ts
import type {
  DashboardMetrics,
  RiskRankingItem,
  ExecutiveSummary,
  SmartAlert,
  CategoryInsight,
} from '@/types/dss';

// Inside recommendationService object:

async getDashboardMetrics(): Promise<DashboardMetrics> {
  const { data } = await api.get<DashboardMetrics>('/api/dss/dashboard');
  return data;
},

async getRiskRanking(): Promise<RiskRankingItem[]> {
  const { data } = await api.get<RiskRankingItem[]>('/api/dss/risk-ranking');
  return data;
},

async getExecutiveSummary(): Promise<ExecutiveSummary> {
  const { data } = await api.get<ExecutiveSummary>('/api/dss/executive-summary');
  return data;
},

async getSmartAlerts(): Promise<SmartAlert[]> {
  const { data } = await api.get<SmartAlert[]>('/api/dss/alerts');
  return data;
},

async getCategoryInsight(categoryId: number): Promise<CategoryInsight> {
  const { data } = await api.get<CategoryInsight>(`/api/dss/category/${categoryId}`);
  return data;
},

/** Fetch all DSS data in one page load (parallel) */
async getDssBundle() {
  const [dashboard, riskRanking, executiveSummary, alerts] = await Promise.all([
    this.getDashboardMetrics(),
    this.getRiskRanking(),
    this.getExecutiveSummary(),
    this.getSmartAlerts(),
  ]);
  return { dashboard, riskRanking, executiveSummary, alerts };
},
```

---

## Zustand Store Suggestion

Create `frontend/src/store/dssStore.ts` mirroring your existing `recommendationStore`:

```ts
import { create } from 'zustand';
import recommendationService from '@/api/recommendationService';
import type { DashboardMetrics, RiskRankingItem, ExecutiveSummary, SmartAlert } from '@/types/dss';

interface DssStore {
  dashboard: DashboardMetrics | null;
  riskRanking: RiskRankingItem[];
  executiveSummary: ExecutiveSummary | null;
  alerts: SmartAlert[];
  loading: boolean;
  error: string | null;
  lastFetchedAt: string | null;
  fetchDss: () => Promise<void>;
}

const CACHE_MS = 10 * 60 * 1000; // 10 minutes

export const useDssStore = create<DssStore>((set, get) => ({
  dashboard: null,
  riskRanking: [],
  executiveSummary: null,
  alerts: [],
  loading: false,
  error: null,
  lastFetchedAt: null,

  fetchDss: async () => {
    const last = get().lastFetchedAt;
    if (last && Date.now() - new Date(last).getTime() < CACHE_MS) return;

    set({ loading: true, error: null });
    try {
      const bundle = await recommendationService.getDssBundle();
      set({
        ...bundle,
        loading: false,
        lastFetchedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load DSS data', loading: false });
    }
  },
}));
```

---

## Page-by-Page Integration Guide

### 1. `ManagerOverview.tsx` — Add operational risk layer

**Currently:** Calls Node.js `managerApi.getOverview()` for basic counts.

**Suggested approach:** Combine both data sources.

| Source | Data |
|--------|------|
| Node.js `/api/manager/overview` | Total, pending, resolved, appealed (real-time DB counts) |
| Python `/api/dss/dashboard` | Risk score, high-priority unresolved, hotspot location |
| Python `/api/dss/alerts` | Top 3 alerts as banner |

```tsx
useEffect(() => {
  Promise.all([
    managerApi.getOverview(),
    recommendationService.getDssBundle(),
  ]).then(([ovRes, dss]) => {
    setOverview(ovRes.data.overviewData);
    setDss(dss);
  });
}, []);
```

Add a **risk gauge card** next to existing KPIs using `dashboard.overall_risk_score` and `dashboard.overall_risk_level`.

---

### 2. `Analytics.tsx` — Replace mock data

**Currently:** Hardcoded `data` and `categoryData` arrays.

**Replace with:**

| Mock section | DSS endpoint | Chart type |
|--------------|--------------|------------|
| Category breakdown | `GET /api/dss/risk-ranking` | Horizontal `BarChart` (`risk_score` per category) |
| KPI cards | `GET /api/dss/dashboard` | Stat cards |
| Weekly trend | Keep Node heatmap or add later | `BarChart` (no DSS endpoint yet for daily trend) |

`Analytics.tsx` is the **highest-impact** page to wire up — it is entirely mock today.

---

### 3. `ManagerRecommendations.tsx` — Enrich existing cards

**No API changes required** — recommendations already load correctly.

**Enhancements:**

1. **Executive summary** at top via `getExecutiveSummary()`.
2. **Alert strip** above the list via `getSmartAlerts()` — filter to categories that have recommendations.
3. **Risk badge** on each card: cross-reference `rec.category_id` with `riskRanking` from DSS.
4. **Drill-down drawer:** on card click, call `getCategoryInsight(rec.category_id)` to show `findings` and `confident_root_cause`.

Example risk badge on existing card:

```tsx
const risk = riskRanking.find(r => r.category_id === rec.category_id);
{risk && (
  <Badge className={riskLevelColors[risk.risk_level]}>
    Risk: {risk.risk_score} ({risk.risk_level})
  </Badge>
)}
```

---

### 4. `TopIssues` placeholder (`/manager/top-issues`)

**Currently:** "Coming soon" in `App.tsx`.

**Suggested implementation:**

- `GET /api/dss/risk-ranking` → table of categories by risk
- `GET /api/dss/category/{id}` on row click → detail panel with `findings` + `dominant_keywords`
- Optionally still show `recommendation.recommendation` from existing store for action items

This replaces the unused Node.js `AnalysisReports` path with live DSS data.

---

### 5. `ManagerHeatmap.tsx` — Complementary, not replacement

Node.js heatmap (`/api/manager/heatmap`) shows raw distribution by location/time/category.  
DSS `hotspot_location` + `hotspot_share_pct` on risk ranking adds **interpretation** ("Library is 45% of IT complaints").

Show DSS hotspots as annotated tooltips on the heatmap, or a side panel listing `alert_type === 'location_hotspot'` alerts.

---

## Recommended Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Executive Summary (GET /api/dss/executive-summary)         │
├─────────────────────────────────────────────────────────────┤
│  [Risk Score] [Unresolved] [High Priority] [Hotspot]      │  ← dashboard
├──────────────────────────┬──────────────────────────────────┤
│  Risk Ranking Chart      │  Smart Alerts List               │
│  (GET /risk-ranking)     │  (GET /alerts)                   │
├──────────────────────────┴──────────────────────────────────┤
│  AI Recommendations (existing GET /manager/recommendations) │
└─────────────────────────────────────────────────────────────┘
```

Fetch the top section with `getDssBundle()` once on mount.  
Fetch recommendations separately via existing `useRecommendationStore`.

---

## Error Handling

| Status | Meaning | Frontend action |
|--------|---------|-----------------|
| `404` | No complaint data (or category &lt; 5 complaints) | Show empty state: "Not enough data for analysis" |
| `500` | Server/pipeline error | Toast + retry button |
| Network error | Python service not running | "AI service offline — start port 8000" |

DSS endpoints return `404` when the DB has zero complaints in the 180-day window.  
Recommendations return `[]` in the same case (not an error).

---

## Risk Level → UI Colors

Use consistently across badges, charts, and gauges:

```ts
export const RISK_COLORS: Record<string, string> = {
  Low:    'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
  Medium: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  High:   'text-rose-600 bg-rose-500/10 border-rose-500/20',
};
```

Risk score gauge domains:

- **0–33** → Low (green)
- **34–66** → Medium (amber)
- **67–100** → High (red)

---

## Node.js vs Python — Which API When?

| Need | Use |
|------|-----|
| Complaint counts, department table, heatmap raw data | Node.js `managerApi` (port 3000) |
| AI recommendations, generate, update status | Python `recommendationService` (port 8000) |
| Risk scores, alerts, executive summary, root cause analytics | Python DSS endpoints (port 8000) |

Both Python and Node read the **same PostgreSQL database**. DSS analytics are computed in Python; they are not exposed through Node today.

---

## Running the Service Locally

```bash
cd ai_services/recommendation
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
<<<<<<< HEAD
# Copy .env.example → .env, set DATABASE_URL and GROQ_API_KEY
uvicorn main:app --reload --port 8000
```

Then start the frontend (`npm run dev`) and ensure `VITE_RECOMMENDATION_API_URL=http://127.0.0.1:8000`.
=======
```

### 4. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/complaints_db
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
RECOMMENDATION_CACHE_HOURS=24
```

> ⚠️ Never commit `.env` to GitHub. It contains your API key and database password.

### 5. Run the database migration

Make sure the `ai_recommendations` table has all required columns. Run this in MySQL Workbench:

```sql
ALTER TABLE ai_recommendations
    ADD COLUMN IF NOT EXISTS root_cause       TEXT         NULL,
    ADD COLUMN IF NOT EXISTS urgency          ENUM('high','medium','low') NULL,
    ADD COLUMN IF NOT EXISTS estimated_impact TEXT         NULL,
    ADD COLUMN IF NOT EXISTS location         VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS complaint_count  INT          NULL,
    ADD COLUMN IF NOT EXISTS avg_resolution_h INT          NULL,
    ADD COLUMN IF NOT EXISTS appeal_rate_pct  INT          NULL,
    ADD COLUMN IF NOT EXISTS top_keywords     VARCHAR(512) NULL,
    ADD COLUMN IF NOT EXISTS generated_at     DATETIME     NULL;
```

### 6. Start the server

```bash
uvicorn main:app --reload --port 5000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:5000 (Press CTRL+C to quit)
INFO:     Started reloader process


---

## Quick Test Checklist

- [ ] `GET http://127.0.0.1:8000/` → `{ "status": "running" }`
- [ ] `GET http://127.0.0.1:8000/api/dss/dashboard` → KPI JSON
- [ ] `GET http://127.0.0.1:8000/api/dss/risk-ranking` → array sorted by risk
- [ ] `GET http://127.0.0.1:8000/api/dss/alerts` → alerts array (may be empty)
- [ ] `GET http://127.0.0.1:8000/api/manager/recommendations` → existing recommendations still work
- [ ] `POST http://127.0.0.1:8000/api/chat/recommendations` → still generates (slow)

<<<<<<< HEAD
Use Swagger at `/docs` to try all endpoints interactively.
=======
```
http://127.0.0.1:5000/docs
```

This opens the Swagger UI where you can test all endpoints interactively.

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat/recommendations` | Run the full pipeline and generate recommendations |
| `GET`  | `/api/manager/recommendations` | List all stored recommendations |
| `GET`  | `/api/manager/recommendations?status=pending` | Filter by status |
| `GET`  | `/api/manager/recommendations?category_id=9` | Filter by category |
| `PATCH`| `/api/manager/recommendations/{id}` | Mark as implemented or ignored |
| `GET`  | `/` | Health check |

### Quick Test

**Step 1** — Generate recommendations:
```
POST /api/chat/recommendations
```
Click Execute. This runs the full pipeline.

**Step 2** — View saved recommendations:
```
GET /api/manager/recommendations
```

**Step 3** — Mark one as implemented (replace 1 with actual id):
```
PATCH /api/manager/recommendations/1
Body: { "status": "implemented" }


---

## Files Added on the Backend (for reference)

| File | Role |
|------|------|
| `dss_analytics.py` | Root cause analysis, risk scoring, alerts, executive summary |
| `dss_routes.py` | FastAPI router for `/api/dss/*` endpoints |
| `checks.json` | Optional alert config (`enabled: true/false`) — no frontend action needed |

**Modified:** `recommendation.py` (pipeline integration + smarter prompt), `main.py` (registers DSS router).

---

## Questions?

- Interactive API docs: `http://127.0.0.1:8000/docs`
- Existing frontend integration: `frontend/src/api/recommendationService.ts`
- Recommendation types: `frontend/src/types/recommendation.ts`
