from typing import Optional
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


def _now_utc() -> str:
    """Return current UTC time as ISO string (consistent across all models)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


class Project(SQLModel, table=True):
    id: str = Field(primary_key=True)        # 'p1', 'p2', 'p3'
    name: str
    phases: str                               # JSON string: '["RTL Freeze", ...]'
    components: str                           # JSON string: '["ALU Core", ...]'


class TestRun(SQLModel, table=True):
    __tablename__ = "test_runs"

    id: str = Field(primary_key=True)         # regression name — BASIC_SANITY_TESTING
    name: str = Field(default="", index=True) # display name (same as id for GUI-created runs)
    project_id: str = Field(index=True)
    phase: str
    component: str
    module: str
    status: str = "running"                   # latest status: 'running' | 'passed' | 'failed'
    progress: int = 0
    scheduler: str                            # 'Nightly' | 'Weekly' | 'Bi-weekly' | 'Monthly'
    start_time: str                           # ISO datetime string
    end_time: Optional[str] = None
    total_tests: int = 0
    passed_tests: int = 0
    failed_tests: int = 0
    log_path: Optional[str] = None


class RunResult(SQLModel, table=True):
    """One row per execution of a regression. Sub-table of test_runs."""
    __tablename__ = "run_results"

    id: Optional[int] = Field(default=None, primary_key=True)
    regression_id: str = Field(index=True)    # FK → test_runs.id
    project_id: str = Field(index=True)       # denormalised for fast dashboard queries
    phase: str
    component: str
    scheduler: str
    total_tests: int = 0
    passed_tests: int = 0
    failed_tests: int = 0
    status: str = "failed"
    log_path: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    executed_at: str = Field(default_factory=_now_utc)


class CoverageSnapshot(SQLModel, table=True):
    __tablename__ = "coverage_snapshots"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: str = Field(index=True)
    phase: str
    component: str
    run_id: Optional[str] = None              # FK to test_runs.id
    line_coverage: float
    toggle_coverage: float
    fsm_coverage: float
    condition_coverage: float
    recorded_at: str = Field(default_factory=_now_utc)


class Schedule(SQLModel, table=True):
    __tablename__ = "schedules"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: str
    module: str
    frequency: str                            # 'Daily at 00:00 UTC', etc.
    branch: str
    enabled: bool = True                       # True = active, False = paused
    created_at: str = Field(default_factory=_now_utc)


class ApiKey(SQLModel, table=True):
    """A named, individually revocable API key with an ownership record.

    Only the SHA-256 hash of the key is stored — the raw value is returned once
    at creation and is unrecoverable afterwards. `prefix` exists so the UI can
    identify a key without holding anything sensitive. The owner fields exist so
    a leaked or stale key can be traced to a person without guesswork.
    """
    __tablename__ = "api_keys"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str                                 # human label e.g. "Nightly CI"
    prefix: str                               # first 12 chars of the raw key, for display
    key_hash: str = Field(index=True)         # SHA-256(raw_key) — never store the raw key
    project_id: Optional[str] = Field(default=None, index=True)   # None = global key

    owner_name: str = ""                      # who is accountable for this key
    owner_email: str = ""                     # how to reach them
    team: Optional[str] = None
    purpose: Optional[str] = None             # what it is used for
    expires_at: Optional[str] = None          # YYYY-MM-DD; refused on/after this date

    created_at: str = Field(default_factory=_now_utc)
    last_used_at: Optional[str] = None


class IntegrationSettings(SQLModel, table=True):
    __tablename__ = "integration_settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: str = Field(unique=True)
    ci_host: str = ""
    ci_job_path: str = ""
    slack_webhook: str = ""
    email_list: str = ""
    updated_at: str = Field(default_factory=_now_utc)
