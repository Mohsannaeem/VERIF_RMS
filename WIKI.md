# UI Showcase — VERIF RMS

A page-by-page walkthrough of the Regression Management System with sample data.

---

## Dashboard

> **Project:** FALCON_SOC &nbsp;|&nbsp; **Phase:** Q1 &nbsp;|&nbsp; **Component:** All Components &nbsp;|&nbsp; **Duration:** Daily

### Summary Cards

Figures below reflect the **last execution of each regression**, summed — not all-time totals.

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   Total Tests    │  │     Passed       │  │     Failed       │  │   Pass Rate      │
│                  │  │                  │  │                  │  │                  │
│     12 450       │  │     11 203       │  │      1 247       │  │     89.98 %      │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

### Pass Rate Trend — Daily (last 7 days)

| Day       | Passed | Failed | Pass Rate |
|-----------|-------:|-------:|----------:|
| Mon 23    |  9 840 |  1 560 |    86.3 % |
| Tue 24    | 10 200 |  1 100 |    90.3 % |
| Wed 25    |      — |      — |         — |
| Thu 26    | 10 850 |    950 |    91.9 % |
| Fri 27    | 11 203 |  1 247 |    90.0 % |
| Sat 28    |      — |      — |         — |
| Sun 29    |      — |      — |         — |

> `—` means no executions ran that day. The chart shows a gap rather than a false 0 %.

---

### Regression Run Breakdown

> **Selected regression:** Q1_CPU_FULL

```
Tests
12 000 ┤                                          ◆ Total
11 500 ┤              ●────────────────────────◆
11 000 ┤         ●───●                        ╱
10 500 ┤    ●───●                       ◆────◆
10 000 ┤●──●                      ◆────◆
 9 500 ┤                     ◆───◆              ● Passed
 9 000 ┤
 1 800 ┤▲──▲──▲──▲──▲──▲──▲──▲──▲──▲──▲──▲──▲ ▲ Failed
       └──────────────────────────────────────────
       #1  #2  #3  #4  #5  #6  #7  #8  #9  #10
```

**Detail Panel — Q1_CPU_FULL**

| Field | Value |
|-------|-------|
| Executions | 10 |
| Module | CPU |
| Phase | Q1 |
| Scheduler | Daily |
| Status | ✅ PASSED |
| Latest Pass Rate | 90.0 % |

---

## Test Runs

> **Project:** FALCON_SOC &nbsp;|&nbsp; **Phase:** Q1 &nbsp;|&nbsp; **Status:** All

### Regression Table

| | Name | ID | Phase | Component | Scheduler | Total | Passed | Failed | Pass Rate | Status | Last Run |
|-|------|----|-------|-----------|-----------|------:|-------:|-------:|----------:|--------|----------|
| ▶ | Q1 CPU Full Regression | Q1_CPU_FULL | Q1 | CPU | Daily | 11 450 | 10 203 | 1 247 | 89.1 % | ✅ PASSED | 2025-06-27 23:45 |
| ▶ | Q1 Memory Stress | Q1_MEM_STRESS | Q1 | MEM | Daily | 8 200 | 8 200 | 0 | 100.0 % | ✅ PASSED | 2025-06-27 22:10 |
| ▶ | Q1 PCIe Link Check | Q1_PCIE_LINK | Q1 | PCIe | Weekly | 3 400 | 2 890 | 510 | 85.0 % | ❌ FAILED | 2025-06-24 08:30 |
| ▶ | Q1 DDR Bringup | Q1_DDR_BRINGUP | Q1 | DDR | Bi-weekly | 5 600 | 5 600 | 0 | 100.0 % | ✅ PASSED | 2025-06-21 14:00 |
| ▶ | Q1 Power Domains | Q1_POWER | Q1 | PWR | Weekly | 2 100 | 1 764 | 336 | 84.0 % | ❌ FAILED | 2025-06-24 06:00 |
| ▶ | Q1 Security Suite | Q1_SECURITY | Q1 | SEC | Monthly | 4 800 | 4 512 | 288 | 94.0 % | ✅ PASSED | 2025-06-01 02:00 |

---

### Expanded Row — Q1_CPU_FULL

> Execution history &nbsp;|&nbsp; **Showing 10 of 24 executions** &nbsp;|&nbsp; Limit: `[10 ▾]`

| # | Status | Total | Passed | Failed | Pass Rate | Executed At | Log |
|--:|--------|------:|-------:|-------:|----------:|-------------|-----|
| 15 | ✅ PASSED | 11 450 | 10 430 | 1 020 | 91.1 % | 2025-06-18 23:41 | 📄 |
| 16 | ✅ PASSED | 11 450 | 10 580 | 870 | 92.4 % | 2025-06-19 23:39 | 📄 |
| 17 | ❌ FAILED | 11 450 | 9 810 | 1 640 | 85.7 % | 2025-06-20 23:55 | 📄 |
| 18 | ❌ FAILED | 11 450 | 9 640 | 1 810 | 84.2 % | 2025-06-21 23:48 | 📄 |
| 19 | ✅ PASSED | 11 450 | 10 100 | 1 350 | 88.2 % | 2025-06-22 23:43 | 📄 |
| 20 | ✅ PASSED | 11 450 | 10 390 | 1 060 | 90.7 % | 2025-06-23 23:50 | 📄 |
| 21 | ✅ PASSED | 11 450 | 10 200 | 1 250 | 89.1 % | 2025-06-24 23:44 | 📄 |
| 22 | ✅ PASSED | 11 450 | 10 450 | 1 000 | 91.3 % | 2025-06-25 23:47 | 📄 |
| 23 | ❌ FAILED | 11 450 | 9 980 | 1 470 | 87.2 % | 2025-06-26 23:52 | 📄 |
| 24 | ✅ PASSED | 11 450 | 10 203 | 1 247 | 89.1 % | 2025-06-27 23:45 | 📄 |

---

### Create Regression Form

```
┌────────────────────────────────────────────────────────┐
│  + New Regression                                      │
├────────────────────────────────────────────────────────┤
│  Project     [ FALCON_SOC              ▾ ]             │
│  Name        [ Q1 USB Compliance                ]      │
│  ID          [ Q1_USB_COMPLIANCE               ]       │
│  Phase       [ Q1                      ▾ ]             │
│  Component   [ USB                     ▾ ]             │
│  Scheduler   [ Daily                   ▾ ]             │
│                                                        │
│                          [ Cancel ]  [ Create Run ]    │
└────────────────────────────────────────────────────────┘
```

---

## Push Script

Submit results from any CI/CD pipeline after a regression completes:

```bash
python backend/scripts/push_result.py \
  --id    Q1_CPU_FULL   \
  --total  11450        \
  --passed 10203        \
  --failed 1247         \
  --start "2025-06-27T21:00:00" \
  --end   "2025-06-27T23:45:00" \
  --log   "/logs/q1_cpu_full_20250627.log"
```

**Output:**

```
✅ Result pushed successfully
   Regression : Q1_CPU_FULL
   Status     : passed
   Total      : 11450
   Passed     : 10203
   Failed     : 1247
   Pass Rate  : 89.1%
   Executed At: 2025-06-27T23:45:12
```

**Error — regression not found:**

```
❌ 404 – Regression 'Q1_NEW_SUITE' not found.
   Create it via the GUI first, then push results.
```

---

## Projects (via Settings)

Before creating regressions, at least one project must exist.

| ID | Name | Phases | Components |
|----|------|--------|-----------|
| FALCON_SOC | Falcon SoC Platform | Q0, Q1, Q2, Q3 | CPU, MEM, PCIe, DDR, USB, PWR, SEC |
| HAWK_FPGA | Hawk FPGA Prototype | Q0, Q1 | CORE, IO, CLK |
| RAVEN_IP | Raven IP Block | Q0 | MAC, PHY, DMA |

---

## Coverage *(coming soon)*

Will track functional coverage snapshots per component.

```
Component   Covered   Total   Coverage
CPU         14 820    16 000   92.6 %  ████████████████░░░░
MEM          8 100     8 500   95.3 %  ███████████████████░
PCIe         5 600     8 000   70.0 %  ██████████████░░░░░░
DDR          7 200     7 500   96.0 %  ███████████████████░
USB          3 100     5 000   62.0 %  ████████████░░░░░░░░
```

---

## Scheduler *(coming soon)*

Will manage and display scheduled regression jobs.

```
Name              Regression       Frequency   Next Run              Status
Daily CPU Run     Q1_CPU_FULL      Daily       2025-06-28 23:00      🟢 Active
Weekly PCIe       Q1_PCIE_LINK     Weekly      2025-07-01 08:00      🟢 Active
Bi-weekly DDR     Q1_DDR_BRINGUP   Bi-weekly   2025-07-05 14:00      🟡 Paused
Monthly Security  Q1_SECURITY      Monthly     2025-07-01 02:00      🟢 Active
```

---

## Settings / Integrations *(coming soon)*

Configure CI/CD and notification integrations per project.

```
┌─────────────────────────────────────────────────────┐
│  Integrations — FALCON_SOC                          │
├─────────────────────────────────────────────────────┤
│  CI Host      [ https://jenkins.internal       ]    │
│  Job Path     [ /job/FALCON/job/regression     ]    │
│  Slack Hook   [ https://hooks.slack.com/...    ]    │
│  Email List   [ team@company.com               ]    │
│                                                     │
│                              [ Save Settings ]      │
└─────────────────────────────────────────────────────┘
```
