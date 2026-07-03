import json
import os
import re
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone, date as _date

from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from sqlmodel import SQLModel, Session, select
from typing import List, Optional

from database import create_db, get_session
from models import Project, TestRun, RunResult, CoverageSnapshot, Schedule, IntegrationSettings

# ---------------------------------------------------------------------------
# Config from environment (override via .env or shell exports)
# ---------------------------------------------------------------------------
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")
RMS_API_KEY  = os.getenv("RMS_API_KEY", "")   # empty = auth disabled

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_key(key: Optional[str] = Security(_api_key_header)):
    """Optional API-key check. Skipped entirely when RMS_API_KEY is not set."""
    if RMS_API_KEY and key != RMS_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing X-API-Key header.")

# ---------------------------------------------------------------------------
# App + lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db()
    yield

app = FastAPI(title="RMS Backend API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

class ProjectRequest(SQLModel):
    """Request body for creating/updating a project.
    phases and components can be:
      - A comma-separated string:  "Q0, Q1, Q2"
      - A JSON array string:       '["Q0","Q1","Q2"]'
    The backend normalises both into a JSON array before storing.
    """
    id: str
    name: str
    phases: str
    components: str


def _to_json_array(value: str) -> str:
    """Convert 'A, B, C'  or  '["A","B","C"]'  →  '["A","B","C"]'."""
    value = value.strip()
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return json.dumps([str(x).strip() for x in parsed])
    except (json.JSONDecodeError, ValueError):
        pass
    # Treat as comma-separated plain text
    items = [x.strip() for x in value.split(",") if x.strip()]
    return json.dumps(items)


@app.get("/api/projects", response_model=List[Project])
def get_projects(session: Session = Depends(get_session)):
    return session.exec(select(Project)).all()


@app.post("/api/projects", response_model=Project)
def create_project(body: ProjectRequest, session: Session = Depends(get_session), _=Depends(verify_key)):
    existing = session.get(Project, body.id)
    phases_json     = _to_json_array(body.phases)
    components_json = _to_json_array(body.components)

    if existing:
        # Update in place — re-submitting the same id is an upsert, not an error
        existing.name       = body.name
        existing.phases     = phases_json
        existing.components = components_json
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing

    project = Project(
        id=body.id,
        name=body.name,
        phases=phases_json,
        components=components_json,
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


# ---------------------------------------------------------------------------
# Test Runs
# ---------------------------------------------------------------------------

class RunResultsUpdate(SQLModel):
    """Fields a script can push back after a regression completes."""
    status:       Optional[str] = None   # 'running' | 'passed' | 'failed'
    progress:     Optional[int] = None   # 0-100
    end_time:     Optional[str] = None
    total_tests:  Optional[int] = None
    passed_tests: Optional[int] = None
    failed_tests: Optional[int] = None
    log_path:     Optional[str] = None


class RunResultRequest(SQLModel):
    """Payload for pushing a result under an existing regression. Context is
    read from the parent regression row — only results and optional times needed."""
    id:           str           # regression ID (must exist in test_runs)
    total_tests:  int
    passed_tests: int
    failed_tests: int
    start_time:   Optional[str] = None
    end_time:     Optional[str] = None
    log_path:     Optional[str] = None


@app.post("/api/runs/result", response_model=RunResult, status_code=201)
def push_run_result(body: RunResultRequest, session: Session = Depends(get_session), _=Depends(verify_key)):
    """Add a new execution result row under an existing regression.
    The regression must already exist in test_runs (created via the GUI).
    Creating a new regression via this endpoint is not allowed.
    """
    parent = session.get(TestRun, body.id)
    if not parent:
        raise HTTPException(
            status_code=404,
            detail=f"Regression '{body.id}' not found. Create it via the GUI first, then push results."
        )

    now    = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    status = "passed" if body.failed_tests == 0 else "failed"

    result = RunResult(
        regression_id = body.id,
        project_id    = parent.project_id,
        phase         = parent.phase,
        component     = parent.component,
        scheduler     = parent.scheduler,
        total_tests   = body.total_tests,
        passed_tests  = body.passed_tests,
        failed_tests  = body.failed_tests,
        status        = status,
        log_path      = body.log_path,
        start_time    = body.start_time or now,
        end_time      = body.end_time   or now,
        executed_at   = now,
    )
    session.add(result)

    # Update parent regression with latest execution stats
    parent.total_tests  = body.total_tests
    parent.passed_tests = body.passed_tests
    parent.failed_tests = body.failed_tests
    parent.status       = status
    parent.progress     = 100
    parent.end_time     = body.end_time or now
    session.add(parent)

    session.commit()
    session.refresh(result)
    return result


@app.get("/api/runs/results", response_model=List[RunResult])
def get_all_run_results(
    project_id: str,
    phase: Optional[str] = None,
    component: Optional[str] = None,
    session: Session = Depends(get_session),
):
    """Bulk-fetch all run_results for a project/phase/component — avoids N+1 per regression."""
    query = select(RunResult).where(RunResult.project_id == project_id)
    if phase:
        query = query.where(RunResult.phase == phase)
    if component and component != "All Components":
        query = query.where(RunResult.component == component)
    return session.exec(query.order_by(RunResult.executed_at)).all()


@app.get("/api/runs", response_model=List[TestRun])
def get_runs(
    project_id: Optional[str] = None,
    phase: Optional[str] = None,
    component: Optional[str] = None,
    status: Optional[str] = None,
    session: Session = Depends(get_session),
):
    query = select(TestRun)
    if project_id:
        query = query.where(TestRun.project_id == project_id)
    if phase:
        query = query.where(TestRun.phase == phase)
    if component and component != "All Components":
        query = query.where(TestRun.component == component)
    if status:
        query = query.where(TestRun.status == status)
    query = query.order_by(TestRun.start_time.desc())
    return session.exec(query).all()

@app.get("/api/runs/{run_id}", response_model=TestRun)
def get_run(run_id: str, session: Session = Depends(get_session)):
    run = session.get(TestRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run

@app.get("/api/runs/{run_id}/results", response_model=List[RunResult])
def get_run_results(run_id: str, session: Session = Depends(get_session)):
    """Return all execution results for a given regression (ordered oldest→newest)."""
    return session.exec(
        select(RunResult)
        .where(RunResult.regression_id == run_id)
        .order_by(RunResult.executed_at)
    ).all()

@app.get("/api/runs/results", response_model=List[RunResult])
def get_all_run_results(
    project_id: str,
    phase: Optional[str] = None,
    component: Optional[str] = None,
    session: Session = Depends(get_session),
):
    """Bulk fetch all execution results for a project/phase/component in one request.
    Replaces the N+1 pattern of fetching per-regression results individually."""
    query = (
        select(RunResult)
        .where(RunResult.project_id == project_id)
    )
    if phase:
        query = query.where(RunResult.phase == phase)
    if component and component != "All Components":
        query = query.where(RunResult.component == component)
    query = query.order_by(RunResult.executed_at)
    return session.exec(query).all()

@app.post("/api/runs", response_model=TestRun, status_code=201)
def create_run(run: TestRun, session: Session = Depends(get_session), _=Depends(verify_key)):
    if session.get(TestRun, run.id):
        raise HTTPException(status_code=409, detail=f"Run '{run.id}' already exists. Use PATCH /api/runs/{{run_id}} to update.")
    if not run.name:
        run.name = run.id
    session.add(run)
    session.commit()
    session.refresh(run)
    return run

@app.patch("/api/runs/{run_id}", response_model=TestRun)
def update_run(run_id: str, updates: RunResultsUpdate, session: Session = Depends(get_session), _=Depends(verify_key)):
    run = session.get(TestRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found. Create it first via POST /api/runs.")
    for field, val in updates.model_dump(exclude_unset=True).items():
        setattr(run, field, val)
    session.add(run)
    session.commit()
    session.refresh(run)
    return run

@app.delete("/api/runs/{run_id}")
def delete_run(run_id: str, session: Session = Depends(get_session), _=Depends(verify_key)):
    run = session.get(TestRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    # Delete all execution results for this regression first
    results = session.exec(select(RunResult).where(RunResult.regression_id == run_id)).all()
    for r in results:
        session.delete(r)
    session.delete(run)
    session.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Dashboard — one smart endpoint, backend does all calculations
# ---------------------------------------------------------------------------

_DATE_FORMATS = [
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S.%f",
    "%b %d, %Y %H:%M:%S",
    "%m/%d/%Y %H:%M:%S",
    "%Y-%m-%d",
]

def _parse_dt(end_time_str: str):
    """Parse a datetime string in any of the supported formats."""
    s = end_time_str.rstrip("Z").split("+")[0]
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    raise ValueError(f"Unrecognised date format: {end_time_str!r}")

# Anchor for bi-weekly periods — Jan 6 2025 is a Monday, gives clean even boundaries
_BIWEEKLY_ANCHOR = _date(2025, 1, 6)

def _biweekly_start(dt: datetime) -> _date:
    """Return the Monday that starts the 2-week period containing dt."""
    days_since_anchor = (dt.date() - _BIWEEKLY_ANCHOR).days
    period = days_since_anchor // 14
    return _BIWEEKLY_ANCHOR + timedelta(days=period * 14)


# Maps duration dropdown label → scheduler name regex (mirrors frontend SCHED_BUCKETS)
_SCHED_PATTERNS = {
    "Daily":     re.compile(r"daily|nightly", re.IGNORECASE),
    "Weekly":    re.compile(r"^weekly$",       re.IGNORECASE),
    "Bi-weekly": re.compile(r"bi.?weekly",     re.IGNORECASE),
    "Monthly":   re.compile(r"monthly",        re.IGNORECASE),
}

def _bucket_key(end_time_str: str, duration: str) -> str:
    dt = _parse_dt(end_time_str)
    if duration == "Weekly":
        monday = dt - timedelta(days=dt.weekday())
        return monday.strftime("%Y-%m-%d")
    if duration == "Bi-weekly":
        return _biweekly_start(dt).strftime("%Y-%m-%d")
    if duration == "Monthly":
        return dt.strftime("%Y-%m")
    return dt.strftime("%Y-%m-%d")   # Daily


def _bucket_label(key: str, duration: str) -> str:
    if duration == "Weekly":
        dt = datetime.strptime(key, "%Y-%m-%d")
        return f"W{dt.isocalendar()[1]}"
    if duration == "Bi-weekly":
        start = datetime.strptime(key, "%Y-%m-%d")
        end   = start + timedelta(days=13)
        return f"{start.strftime('%b %d')}–{end.strftime('%d')}"
    if duration == "Monthly":
        return datetime.strptime(key, "%Y-%m").strftime("%b")
    return datetime.strptime(key, "%Y-%m-%d").strftime("%a %d")


def _data_range_keys(results: list, duration: str) -> list[str]:
    """Return every bucket key from the oldest result's date to today.
    Falls back to a sensible default window when there is no data."""
    now = datetime.now()

    valid = [r for r in results if r.end_time]
    if not valid:
        # Fallback: fixed small window
        if duration == "Weekly":
            monday = now - timedelta(days=now.weekday())
            return [(monday - timedelta(weeks=i)).strftime("%Y-%m-%d") for i in range(3, -1, -1)]
        if duration == "Bi-weekly":
            cur = _biweekly_start(now)
            return [(cur - timedelta(days=14*i)).strftime("%Y-%m-%d") for i in range(3, -1, -1)]
        if duration == "Monthly":
            keys = []
            for i in range(5, -1, -1):
                m, y = now.month - i, now.year
                while m <= 0: m += 12; y -= 1
                keys.append(f"{y}-{m:02d}")
            return keys
        return [(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]

    oldest = min(_parse_dt(r.end_time) for r in valid)

    if duration == "Daily":
        n_days = (now.date() - oldest.date()).days + 1
        return [(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(n_days - 1, -1, -1)]

    if duration == "Weekly":
        # Walk week-by-week from the Monday of the oldest date's week
        start = oldest - timedelta(days=oldest.weekday())
        keys, cur = [], start.date()
        monday_now = (now - timedelta(days=now.weekday())).date()
        while cur <= monday_now:
            keys.append(cur.strftime("%Y-%m-%d"))
            cur += timedelta(weeks=1)
        return keys

    if duration == "Bi-weekly":
        start = _biweekly_start(oldest)
        keys, cur = [], start
        now_bw = _biweekly_start(now)
        while cur <= now_bw:
            keys.append(cur.strftime("%Y-%m-%d"))
            cur += timedelta(days=14)
        return keys

    if duration == "Monthly":
        keys = []
        y, m = oldest.year, oldest.month
        while (y, m) <= (now.year, now.month):
            keys.append(f"{y}-{m:02d}")
            m += 1
            if m > 12:
                m, y = 1, y + 1
        return keys

    # fallback
    return [(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]


@app.get("/api/dashboard")
def get_dashboard(
    project_id: str,
    phase: Optional[str] = None,
    component: Optional[str] = None,
    duration: str = "Daily",                  # trend bucket width
    session: Session = Depends(get_session),
):
    # ── Query run_results (execution history sub-table) ───────────────────────
    query = (
        select(RunResult)
        .where(RunResult.project_id == project_id)
        .where(RunResult.end_time.isnot(None))
    )
    if phase:
        query = query.where(RunResult.phase == phase)
    if component and component != "All Components":
        query = query.where(RunResult.component == component)

    results = session.exec(query).all()

    # ── Summary: last execution per regression, then sum those ────────────────
    last_per_regression: dict = {}
    for r in results:
        prev = last_per_regression.get(r.regression_id)
        if prev is None or _parse_dt(r.executed_at) > _parse_dt(prev.executed_at):
            last_per_regression[r.regression_id] = r

    last_results = list(last_per_regression.values())
    total  = sum(r.total_tests  for r in last_results)
    passed = sum(r.passed_tests for r in last_results)
    failed = sum(r.failed_tests for r in last_results)
    rate   = round(passed / total * 100, 1) if total > 0 else 0.0

    # ── Trend (executions whose scheduler matches the selected duration mode) ──
    sched_pattern = _SCHED_PATTERNS.get(duration)
    trend_results = [r for r in results if sched_pattern and sched_pattern.search(r.scheduler or "")]

    bucket_totals: dict = defaultdict(lambda: {"passed": 0, "failed": 0})
    for r in trend_results:
        key = _bucket_key(r.end_time, duration)
        bucket_totals[key]["passed"] += r.passed_tests
        bucket_totals[key]["failed"] += r.failed_tests

    trend = []
    for key in _data_range_keys(trend_results, duration):
        b = bucket_totals.get(key, {"passed": 0, "failed": 0})
        p, f = b["passed"], b["failed"]
        total_bucket = p + f
        trend.append({
            "name":      _bucket_label(key, duration),
            "passed":    p,
            "failed":    f,
            "pass_rate": round(p / total_bucket * 100, 1) if total_bucket > 0 else None,
        })

    # ── By-scheduler: last execution per scheduler name ───────────────────────
    sched_last: dict = {}
    for r in results:
        if r.scheduler not in sched_last or _parse_dt(r.end_time) > _parse_dt(sched_last[r.scheduler].end_time):
            sched_last[r.scheduler] = r

    by_scheduler = []
    for sched, r in sched_last.items():
        t = r.total_tests or 0
        p = r.passed_tests or 0
        f = r.failed_tests or 0
        by_scheduler.append({
            "name":      sched,
            "passed":    p,
            "failed":    f,
            "total":     t,
            "value":     p + f,
            "pass_rate": round(p / t * 100, 1) if t > 0 else 0.0,
            "run_id":    r.regression_id,
            "end_time":  r.end_time,
        })

    return {
        "summary":      {"total": total, "passed": passed, "failed": failed, "pass_rate": rate},
        "trend":         trend,
        "by_scheduler":  by_scheduler,
        "run_count":     len(results),
    }


# ---------------------------------------------------------------------------
# Coverage Snapshots
# ---------------------------------------------------------------------------

@app.get("/api/coverage", response_model=List[CoverageSnapshot])
def get_coverage(
    project_id: Optional[str] = None,
    phase: Optional[str] = None,
    component: Optional[str] = None,
    session: Session = Depends(get_session),
):
    query = select(CoverageSnapshot)
    if project_id:
        query = query.where(CoverageSnapshot.project_id == project_id)
    if phase:
        query = query.where(CoverageSnapshot.phase == phase)
    if component and component != "All Components":
        query = query.where(CoverageSnapshot.component == component)
    query = query.order_by(CoverageSnapshot.recorded_at.desc())
    return session.exec(query).all()

@app.get("/api/coverage/latest")
def get_latest_coverage(
    project_id: str,
    phase: str,
    component: str,
    session: Session = Depends(get_session),
):
    query = (
        select(CoverageSnapshot)
        .where(CoverageSnapshot.project_id == project_id)
        .where(CoverageSnapshot.phase == phase)
    )
    if component != "All Components":
        query = query.where(CoverageSnapshot.component == component)
    query = query.order_by(CoverageSnapshot.recorded_at.desc())
    result = session.exec(query).first()
    if not result:
        raise HTTPException(status_code=404, detail="No coverage data found")
    return result

@app.post("/api/coverage", response_model=CoverageSnapshot)
def create_coverage(snapshot: CoverageSnapshot, session: Session = Depends(get_session), _=Depends(verify_key)):
    session.add(snapshot)
    session.commit()
    session.refresh(snapshot)
    return snapshot


# ---------------------------------------------------------------------------
# Schedules
# ---------------------------------------------------------------------------

@app.get("/api/schedules", response_model=List[Schedule])
def get_schedules(
    project_id: Optional[str] = None,
    session: Session = Depends(get_session),
):
    query = select(Schedule)
    if project_id:
        query = query.where(Schedule.project_id == project_id)
    return session.exec(query).all()

@app.post("/api/schedules", response_model=Schedule)
def create_schedule(schedule: Schedule, session: Session = Depends(get_session), _=Depends(verify_key)):
    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    return schedule

@app.delete("/api/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, session: Session = Depends(get_session), _=Depends(verify_key)):
    s = session.get(Schedule, schedule_id)
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    session.delete(s)
    session.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Integration Settings
# ---------------------------------------------------------------------------

@app.get("/api/settings/{project_id}", response_model=IntegrationSettings)
def get_settings(project_id: str, session: Session = Depends(get_session)):
    result = session.exec(
        select(IntegrationSettings).where(IntegrationSettings.project_id == project_id)
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="No settings found for this project")
    return result

@app.post("/api/settings", response_model=IntegrationSettings)
def save_settings(settings: IntegrationSettings, session: Session = Depends(get_session), _=Depends(verify_key)):
    existing = session.exec(
        select(IntegrationSettings).where(IntegrationSettings.project_id == settings.project_id)
    ).first()
    if existing:
        existing.ci_host = settings.ci_host
        existing.ci_job_path = settings.ci_job_path
        existing.slack_webhook = settings.slack_webhook
        existing.email_list = settings.email_list
        existing.updated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings
