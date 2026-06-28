from typing import Optional
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


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
    executed_at: str = Field(
        default_factory=lambda: datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    )


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
    recorded_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Schedule(SQLModel, table=True):
    __tablename__ = "schedules"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: str
    module: str
    frequency: str                            # 'Daily at 00:00 UTC', etc.
    branch: str
    enabled: int = 1                          # 1 = active, 0 = paused
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class IntegrationSettings(SQLModel, table=True):
    __tablename__ = "integration_settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: str = Field(unique=True)
    ci_host: str = ""
    ci_job_path: str = ""
    slack_webhook: str = ""
    email_list: str = ""
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
