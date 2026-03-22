#!/usr/bin/env python3
"""Orchestrate all kdoc governance checks and produce a unified health report.

Runs enabled checks as subprocesses and aggregates results.

Usage:
    python3 governance_health.py [--mode warn|block] [--json]

  --mode warn  (default): exit 0 even with failures, print summary
  --mode block: exit 1 if any check fails
  --json: emit machine-readable JSON report
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional


# ---------------------------------------------------------------------------
# Config discovery
# ---------------------------------------------------------------------------

def find_kdoc_config(start: Path) -> Path:
    """Walk up from start looking for .kdoc.yaml."""
    current = start.resolve()
    while True:
        candidate = current / ".kdoc.yaml"
        if candidate.exists():
            return candidate
        parent = current.parent
        if parent == current:
            raise FileNotFoundError("No .kdoc.yaml found. Is this a kdoc-managed project?")
        current = parent


def _parse_simple_yaml(text: str) -> dict:
    """Parse the subset of YAML used by .kdoc.yaml."""
    result: dict = {}
    stack = [(0, result)]

    for raw_line in text.splitlines():
        if not raw_line.strip() or raw_line.strip().startswith("#"):
            continue

        indent = len(raw_line) - len(raw_line.lstrip())
        line = raw_line.strip()

        while len(stack) > 1 and stack[-1][0] >= indent:
            stack.pop()

        current_dict = stack[-1][1]

        if line.startswith("- "):
            value = line[2:].strip().strip('"').strip("'")
            if "_current_list_key" in current_dict:
                key = current_dict["_current_list_key"]
                current_dict.setdefault(key, []).append(value)
            continue

        if ":" in line:
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if value == "":
                nested: dict = {}
                current_dict[key] = nested
                current_dict["_current_list_key"] = key
                stack.append((indent + 2, nested))
            else:
                current_dict[key] = value
                current_dict["_current_list_key"] = key

    def _clean(d: dict) -> dict:
        return {k: (_clean(v) if isinstance(v, dict) else v) for k, v in d.items() if k != "_current_list_key"}

    return _clean(result)


def load_kdoc_config(config_path: Path) -> dict:
    text = config_path.read_text(encoding="utf-8", errors="ignore")
    return _parse_simple_yaml(text)


def _is_check_enabled(config: dict, check_key: str) -> bool:
    """Check if a governance check is enabled in config."""
    governance = config.get("governance", {})
    if not isinstance(governance, dict):
        return True
    value = governance.get(check_key, True)
    if isinstance(value, str):
        return value.lower() not in ("false", "0", "no", "off")
    return bool(value)


# ---------------------------------------------------------------------------
# Check runner
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent

CHECKS: List[Dict] = [
    {
        "name": "sync-check",
        "config_key": "sync-check",
        "script": SCRIPT_DIR / "check_sync.py",
        "description": "Knowledge sync with code changes",
        "args": ["--worktree"],
    },
    {
        "name": "wikilinks",
        "config_key": "wikilinks",
        "script": SCRIPT_DIR / "check_wikilinks.py",
        "description": "Wikilink integrity",
        "args": [],
    },
    {
        "name": "index-build",
        "config_key": "index-build",
        "script": SCRIPT_DIR / "build_index.py",
        "description": "Rebuild INDEX.md",
        "args": [],
    },
    {
        "name": "adr-governance",
        "config_key": "adr-governance",
        "script": SCRIPT_DIR / "check_adr_governance.py",
        "description": "ADR governance invariants",
        "args": ["--mode", "warn"],
    },
]


def run_check(check: Dict, cwd: Path) -> Dict:
    """Run a single check script and return its result."""
    script = check["script"]
    if not script.exists():
        return {
            "name": check["name"],
            "status": "skipped",
            "message": f"Script not found: {script}",
        }

    cmd = [sys.executable, str(script)] + check.get("args", [])
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=60,
        )
        output = (result.stdout + result.stderr).strip()
        status = "pass" if result.returncode == 0 else "fail"
        return {
            "name": check["name"],
            "status": status,
            "message": output[:500] if output else "(no output)",
        }
    except subprocess.TimeoutExpired:
        return {
            "name": check["name"],
            "status": "fail",
            "message": "Check timed out after 60 seconds",
        }
    except Exception as e:
        return {
            "name": check["name"],
            "status": "fail",
            "message": str(e),
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Orchestrate kdoc governance checks")
    parser.add_argument(
        "--mode",
        choices=["warn", "block"],
        default="warn",
        help="warn = exit 0 even with failures; block = exit 1 on any failure",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON report",
    )
    args = parser.parse_args()

    try:
        config_path = find_kdoc_config(Path.cwd())
    except FileNotFoundError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(2)

    root = config_path.parent
    config = load_kdoc_config(config_path)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    results: List[Dict] = []

    for check in CHECKS:
        if not _is_check_enabled(config, check["config_key"]):
            results.append({
                "name": check["name"],
                "status": "skipped",
                "message": f"Disabled via governance.{check['config_key']}: false",
            })
            continue

        result = run_check(check, root)
        results.append(result)

    any_fail = any(r["status"] == "fail" for r in results)
    overall = "fail" if any_fail else "pass"

    if args.json:
        report = {
            "timestamp": timestamp,
            "overall": overall,
            "checks": results,
        }
        print(json.dumps(report, indent=2))
    else:
        print(f"\nGOVERNANCE HEALTH REPORT — {timestamp}")
        print("=" * 50)
        for r in results:
            icon = "OK" if r["status"] == "pass" else ("SKIP" if r["status"] == "skipped" else "FAIL")
            print(f"  [{icon}] {r['name']}: {r['message'][:120]}")
        print()
        print(f"Overall: {overall.upper()}")

    if args.mode == "block" and any_fail:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
