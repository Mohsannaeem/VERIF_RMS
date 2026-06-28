"""
Push a new result entry under an existing regression.

The regression must already exist (created via the GUI). This script
only adds a new row to run_results — it never creates a new regression.

Usage:
  python scripts/push_result.py \
    --id     BASIC_SANITY_TESTING \
    --total  450 \
    --passed 412 \
    --failed 38

Optional:
  --url    RMS backend base URL   (default: http://localhost:8000)
  --start  Start time ISO string  (default: server sets to now)
  --end    End time ISO string    (default: server sets to now)
  --log    Path to regression log (default: none)
"""

import argparse
import sys
import requests


def parse_args():
    p = argparse.ArgumentParser(description="Push a result entry under an existing regression.")
    p.add_argument("--id",     required=True,  help="Regression ID (must exist in the GUI)")
    p.add_argument("--total",  required=True,  type=int)
    p.add_argument("--passed", required=True,  type=int)
    p.add_argument("--failed", required=True,  type=int)
    p.add_argument("--url",    default="http://localhost:8000")
    p.add_argument("--start",  default=None,   help="Start time (ISO)")
    p.add_argument("--end",    default=None,   help="End time (ISO)")
    p.add_argument("--log",    default=None,   help="Log file path")
    return p.parse_args()


def main():
    args = parse_args()

    if args.passed + args.failed > args.total:
        print(f"ERROR: passed ({args.passed}) + failed ({args.failed}) exceeds total ({args.total})")
        sys.exit(1)

    payload = {
        "id":           args.id,
        "total_tests":  args.total,
        "passed_tests": args.passed,
        "failed_tests": args.failed,
    }
    if args.start: payload["start_time"] = args.start
    if args.end:   payload["end_time"]   = args.end
    if args.log:   payload["log_path"]   = args.log

    print(f"Pushing result for regression '{args.id}' ...")
    try:
        r = requests.post(f"{args.url}/api/runs/result", json=payload, timeout=10)
    except requests.ConnectionError:
        print(f"ERROR: Could not connect to {args.url}. Is the backend running?")
        sys.exit(1)

    if r.status_code == 201:
        data = r.json()
        rate = round(data["passed_tests"] / data["total_tests"] * 100, 1) if data["total_tests"] else 0
        print(f"  Regression : {data['regression_id']}")
        print(f"  Status     : {data['status']}")
        print(f"  Total      : {data['total_tests']}")
        print(f"  Passed     : {data['passed_tests']}")
        print(f"  Failed     : {data['failed_tests']}")
        print(f"  Pass rate  : {rate}%")
        print(f"  Executed at: {data['executed_at']}")
    elif r.status_code == 404:
        print(f"ERROR: {r.json().get('detail', r.text)}")
        sys.exit(1)
    else:
        print(f"ERROR {r.status_code}: {r.text}")
        sys.exit(1)


if __name__ == "__main__":
    main()
