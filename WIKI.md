# UI Showcase — VERIF RMS

A walkthrough of each page in the Regression Management System.

---

## Dashboard

The dashboard gives a live health snapshot across a selected **Project → Phase → Component** combination.

### Summary Cards

Four cards across the top row show the **current state** of your regression suite — not all-time totals. The system takes the **last execution of each regression** and sums those numbers only.

| Card | What it shows |
|------|---------------|
| **Total Tests** | Sum of `total_tests` from the most recent run of every regression |
| **Passed** | Sum of `passed_tests` from those last runs |
| **Failed** | Sum of `failed_tests` from those last runs |
| **Pass Rate** | `passed / total × 100%` across last runs |

### Pass Rate Trend Chart

A line chart showing historical pass rate, grouped by the selected duration bucket:

| Mode | Buckets shown |
|------|--------------|
| **Daily** | Last 7 days |
| **Weekly** | Last 4 weeks (Monday-anchored) |
| **Bi-weekly** | Last 4 bi-weekly periods |
| **Monthly** | Last 6 months |

Days/periods with no executions show a **gap** in the line — no false 0% dot is inserted.

### Regression Run Breakdown

A dropdown lists all regressions. Selecting one shows its full execution history as a **3-line chart**:

| Line | Color | Description |
|------|-------|-------------|
| **Total** | Blue | Total tests per execution |
| **Passed** | Green | Passed tests per execution |
| **Failed** | Red | Failed tests per execution |

X-axis labels show execution number (`#1`, `#2`, …). Hovering shows the exact date and counts.

A **detail panel** on the right shows:
- Executions count
- Module / Phase / Scheduler
- Current status badge
- Latest pass rate

---

## Test Runs

A table of all registered regressions with search and filter controls.

### Filters

- **Project** — top-level dropdown (set once and remembered)
- **Phase** — Q0, Q1, Q2, etc. (populated from the selected project)
- **Component** — CPU, MEM, etc. (populated from the selected project)
- **Status** — All / Passed / Failed / Running
- **Search** — free-text filter on name/ID

### Expandable Rows

Click the **▶** arrow on any regression row to expand its execution history inline.

| Column | Description |
|--------|-------------|
| # | Execution number (oldest → newest) |
| Status | Passed / Failed badge |
| Total | Total tests |
| Passed | Passed tests |
| Failed | Failed tests |
| Pass Rate | `passed / total × 100%` |
| Executed At | Local timestamp |
| Log | Link if a log path was submitted |

A **limit dropdown** in the sub-table header controls how many rows to show:

| Option | Rows displayed |
|--------|---------------|
| 10 (default) | Last 10 executions |
| 25 | Last 25 executions |
| 50 | Last 50 executions |
| All | Every execution |

A counter shows `Showing X of Y executions`.

### Creating a Regression

Click **+ New Run** in the top-right toolbar. Fill in:

- **Project** — must exist first (create via Settings)
- **Name** — human-readable label shown in all views
- **ID** — unique key used by the push script (`--id` flag)
- **Phase** and **Component** — from the project's configured lists
- **Scheduler** — Daily / Weekly / Bi-weekly / Monthly (used for trend bucketing on the dashboard)

### Deleting a Regression

The **delete** button on any row removes the regression definition **and all its execution history** in one step. This action cannot be undone.

---

## Push Script Flow

```
CI/CD job finishes
       │
       ▼
push_result.py --id MY_REGRESS --total 500 --passed 487 --failed 13
       │
       ▼
POST /api/runs/result
       │
       ├─ Regression exists? ──No──▶ 404 Error (create it in GUI first)
       │
       └─ Yes ──▶ New row in run_results
                  Parent test_runs row updated with latest stats
                  Dashboard summary cards updated on next load
```

---

## Coverage *(coming soon)*

Will track functional coverage snapshots per component, with trend charts showing coverage growth over time.

---

## Scheduler *(coming soon)*

Will display and manage scheduled regression jobs — configure recurrence, next-run time, and notification targets.

---

## Settings *(coming soon)*

Will configure integrations per project:
- CI/CD host and job path (e.g. Jenkins URL)
- Slack webhook for pass/fail notifications
- Email distribution list for reports
