# VERIF RMS — Regression Management System

A dark-themed internal platform for managing, tracking, and reporting hardware/software regression suites across projects, phases, and components.

Built with **FastAPI + SQLite** on the backend and **React + Vite + Recharts** on the frontend.

---

## Features

- **Project Management** — Define projects with configurable phases and components
- **Regression Registry** — Create named regressions tied to a project, phase, component, and scheduler
- **Execution History** — Each regression accumulates run results over time; rows expand inline to show full history with a configurable row-limit dropdown
- **Live Dashboard** — Summary cards (using last execution per regression), pass-rate trend chart (Daily / Weekly / Bi-weekly / Monthly), and a per-regression breakdown chart with 3-line history (Total / Passed / Failed)
- **Push via Script** — `push_result.py` submits results from any CI/CD pipeline without touching the GUI; the regression must exist first
- **Cascade Delete** — Deleting a regression removes all its execution history in one action

---

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Backend  | Python · FastAPI · SQLModel · SQLite |
| Frontend | React 18 · Vite · Recharts · React Router |
| Database | SQLite (file-based, zero config) |

---

## Project Structure

```
RMS/
├── backend/
│   ├── main.py              # All FastAPI routes
│   ├── models.py            # SQLModel table definitions
│   ├── database.py          # Engine, session, auto-migration
│   ├── requirements.txt
│   └── scripts/
│       └── push_result.py   # CLI for submitting run results
└── frontend/
    ├── src/
    │   ├── api.js            # API base URL — single source of truth
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── TestRuns.jsx
    │   │   ├── Coverage.jsx
    │   │   ├── Scheduler.jsx
    │   │   └── Settings.jsx
    │   └── components/
    │       └── Layout.jsx    # Sidebar + top nav
    └── vite.config.js
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.10+ |
| Node.js | 18+ |

---

## Local Setup

### 1 — Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

- API: **http://localhost:8000**
- Interactive docs: **http://localhost:8000/docs**

The SQLite database (`rms.db`) is created automatically on first run. Schema migrations run at startup — safe to restart at any time.

### 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

- App: **http://localhost:5173**

---

## Pushing Results from CI/CD

Create the regression in the GUI first, then push results from your pipeline:

```bash
python backend/scripts/push_result.py \
  --id    MY_REGRESSION \
  --total  500          \
  --passed 487          \
  --failed 13
```

> The regression **must exist** in the GUI before pushing. The script returns `404` if the ID is not found — it cannot create new regressions.

**Optional flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--start` | Start time (`YYYY-MM-DDTHH:MM:SS`) | now |
| `--end` | End time (`YYYY-MM-DDTHH:MM:SS`) | now |
| `--log` | Path to log file | — |
| `--url` | Backend base URL | `http://localhost:8000` |

**Example with all options:**

```bash
python backend/scripts/push_result.py \
  --id    Q1_REGRESS          \
  --total  2000               \
  --passed 1850               \
  --failed 150                \
  --start "2025-06-28T08:00:00" \
  --end   "2025-06-28T10:30:00" \
  --log   "/logs/q1_20250628.log"
```

---

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create / update a project |
| `GET` | `/api/runs` | List regressions (filter by project, phase, component, status) |
| `POST` | `/api/runs` | Create a regression (GUI only) |
| `DELETE` | `/api/runs/{id}` | Delete regression + all its history |
| `POST` | `/api/runs/result` | Push a run result (regression must exist) |
| `GET` | `/api/runs/{id}/results` | Execution history for a regression |
| `GET` | `/api/dashboard` | Summary cards, trend, scheduler breakdown |

Full interactive docs at **http://localhost:8000/docs** when backend is running.

---

## Database Schema

### `test_runs` — Regression definitions

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Unique regression identifier |
| `name` | TEXT | Display name |
| `project_id` | TEXT | Parent project |
| `phase` | TEXT | e.g. Q0, Q1, Q2 |
| `component` | TEXT | e.g. CPU, MEM |
| `scheduler` | TEXT | Daily / Weekly / Bi-weekly / Monthly |
| `status` | TEXT | passed / failed / running |
| `total_tests` | INT | From last execution |
| `passed_tests` | INT | From last execution |
| `failed_tests` | INT | From last execution |

### `run_results` — Execution history

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK | Auto-increment |
| `regression_id` | TEXT FK | References `test_runs.id` |
| `executed_at` | TEXT | Local timestamp of submission |
| `total_tests` | INT | This execution's total |
| `passed_tests` | INT | This execution's passed |
| `failed_tests` | INT | This execution's failed |
| `status` | TEXT | passed / failed |
| `start_time` | TEXT | Optional run start |
| `end_time` | TEXT | Optional run end |
| `log_path` | TEXT | Optional path to log |

---

## Screenshots

See [WIKI.md](WIKI.md) for a full walkthrough of each page with annotated descriptions.
