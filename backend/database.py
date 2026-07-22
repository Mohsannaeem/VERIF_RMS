import os
import re
from sqlmodel import create_engine, Session, SQLModel
from sqlalchemy import text

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///rms.db")
engine = create_engine(DATABASE_URL, echo=False)

_RESULT_ID_RE = re.compile(r'_\d{8}_\d{6}$|^\d{8}_\d{6}$')


def create_db():
    SQLModel.metadata.create_all(engine)
    _migrate()


def _migrate():
    with engine.connect() as conn:
        # Add name column to test_runs if missing
        try:
            conn.execute(text("ALTER TABLE test_runs ADD COLUMN name TEXT NOT NULL DEFAULT ''"))
            conn.commit()
            conn.execute(text("UPDATE test_runs SET name = id WHERE name = ''"))
            conn.commit()
        except Exception:
            pass

        # Create run_results table if missing
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS run_results (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                regression_id TEXT NOT NULL,
                project_id    TEXT NOT NULL,
                phase         TEXT NOT NULL,
                component     TEXT NOT NULL,
                scheduler     TEXT NOT NULL,
                total_tests   INTEGER DEFAULT 0,
                passed_tests  INTEGER DEFAULT 0,
                failed_tests  INTEGER DEFAULT 0,
                status        TEXT DEFAULT 'failed',
                log_path      TEXT,
                start_time    TEXT,
                end_time      TEXT,
                executed_at   TEXT NOT NULL
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_run_results_regression_id ON run_results(regression_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_run_results_project_id    ON run_results(project_id)"))
        conn.commit()

        # Create api_keys table if missing
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                name         TEXT NOT NULL,
                prefix       TEXT NOT NULL,
                key_hash     TEXT NOT NULL,
                project_id   TEXT,
                created_at   TEXT NOT NULL,
                last_used_at TEXT
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_api_keys_key_hash   ON api_keys(key_hash)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_api_keys_project_id ON api_keys(project_id)"))
        conn.commit()

        # Ownership columns, added separately: CREATE TABLE IF NOT EXISTS is a
        # no-op on installs that already have the first-cut api_keys table.
        for column, ddl in [
            ("owner_name",  "owner_name TEXT NOT NULL DEFAULT ''"),
            ("owner_email", "owner_email TEXT NOT NULL DEFAULT ''"),
            ("team",        "team TEXT"),
            ("purpose",     "purpose TEXT"),
            ("expires_at",  "expires_at TEXT"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE api_keys ADD COLUMN {ddl}"))
                conn.commit()
            except Exception:
                pass   # already present

        # Migrate old timestamped test_runs rows into run_results
        rows = conn.execute(text("SELECT * FROM test_runs")).mappings().fetchall()
        for row in rows:
            rid = row['id']
            if not _RESULT_ID_RE.search(rid):
                continue
            regression_id = re.sub(r'_\d{8}_\d{6}$', '', rid)
            if regression_id == rid:
                regression_id = rid
            already = conn.execute(
                text("SELECT 1 FROM run_results WHERE regression_id=:r AND end_time=:e"),
                {"r": regression_id, "e": row['end_time']},
            ).fetchone()
            if not already:
                conn.execute(text("""
                    INSERT INTO run_results
                        (regression_id, project_id, phase, component, scheduler,
                         total_tests, passed_tests, failed_tests, status,
                         log_path, start_time, end_time, executed_at)
                    VALUES
                        (:regression_id, :project_id, :phase, :component, :scheduler,
                         :total_tests, :passed_tests, :failed_tests, :status,
                         :log_path, :start_time, :end_time, :executed_at)
                """), {
                    "regression_id": regression_id,
                    "project_id":    row['project_id'],
                    "phase":         row['phase'],
                    "component":     row['component'],
                    "scheduler":     row['scheduler'],
                    "total_tests":   row['total_tests'],
                    "passed_tests":  row['passed_tests'],
                    "failed_tests":  row['failed_tests'],
                    "status":        row['status'],
                    "log_path":      row['log_path'],
                    "start_time":    row['start_time'],
                    "end_time":      row['end_time'],
                    "executed_at":   row['end_time'] or row['start_time'],
                })
            conn.execute(text("DELETE FROM test_runs WHERE id = :id"), {"id": rid})
        conn.commit()


def get_session():
    with Session(engine) as session:
        yield session
