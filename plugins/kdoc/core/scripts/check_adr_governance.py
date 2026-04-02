#!/usr/bin/env python3
"""Validate ADR governance invariants.

Checks:
G1. Accepted ADRs have required sections (Context, Decision Drivers,
    Decision or Decisions, Alternatives considered, Consequences).
G2. Every ADR file has a line in the ADR-CROSS-REFERENCES.md Dependency Map.
G3. README.md sequence = highest ADR number + 1.
G4. README.md approval queue = set of ADRs with status: proposed.

Reads configuration from .kdoc.yaml:
  root: Knowledge
  areas:
    adr:
      enabled: true

Usage:
    python3 check_adr_governance.py --mode warn
    python3 check_adr_governance.py --mode block
"""

import argparse
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Set


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
    lines = []
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(raw_line) - len(raw_line.lstrip())
        lines.append((indent, stripped))

    def _parse_scalar(raw: str):
        value = raw.strip().strip('"').strip("'")
        lowered = value.lower()
        if value in ("[]", "[ ]"):
            return []
        if value in ("{}", "{ }"):
            return {}
        if value.startswith("{") and value.endswith("}"):
            inner = value[1:-1].strip()
            if not inner:
                return {}
            result = {}
            for entry in inner.split(","):
                key, _, raw_item = entry.partition(":")
                result[key.strip()] = _parse_scalar(raw_item)
            return result
        if lowered == "true":
            return True
        if lowered == "false":
            return False
        return value

    def _parse_list(start: int, indent: int):
        items = []
        index = start
        while index < len(lines):
            line_indent, line = lines[index]
            if line_indent < indent or line_indent != indent or not line.startswith("- "):
                break
            items.append(_parse_scalar(line[2:]))
            index += 1
        return items, index

    def _parse_dict(start: int, indent: int):
        data = {}
        index = start
        while index < len(lines):
            line_indent, line = lines[index]
            if line_indent < indent:
                break
            if line_indent != indent or line.startswith("- ") or ":" not in line:
                break

            key, _, raw_value = line.partition(":")
            key = key.strip()
            raw_value = raw_value.strip()

            if raw_value:
                data[key] = _parse_scalar(raw_value)
                index += 1
                continue

            next_index = index + 1
            if next_index >= len(lines) or lines[next_index][0] <= indent:
                data[key] = {}
                index += 1
                continue

            child_indent, child_line = lines[next_index]
            if child_line.startswith("- "):
                data[key], index = _parse_list(next_index, child_indent)
            else:
                data[key], index = _parse_dict(next_index, child_indent)

        return data, index

    parsed, _ = _parse_dict(0, 0)
    return parsed


def load_kdoc_config(config_path: Path) -> dict:
    text = config_path.read_text(encoding="utf-8", errors="ignore")
    return _parse_simple_yaml(text)


def _load_knowledge_structure(root: Path) -> dict:
    """Load core/schema/knowledge-structure.json for area directory mappings."""
    script_dir = Path(__file__).resolve().parent
    candidates = [
        script_dir / ".." / "schema" / "knowledge-structure.json",
        root / "core" / "schema" / "knowledge-structure.json",
    ]
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved.exists():
            import json
            return json.loads(resolved.read_text(encoding="utf-8"))
    return {}


def _adr_directory(structure: dict, default: str = "ADR") -> str:
    areas = structure.get("areas", {})
    if isinstance(areas, dict):
        adr_area = areas.get("adr", {})
        if isinstance(adr_area, dict):
            return str(adr_area.get("directory", default))
    return default


# ---------------------------------------------------------------------------
# ADR governance checks (generalized from AVShop2/scripts/check_adr_governance.py)
# ---------------------------------------------------------------------------

# Project-specific exceptions: accepted ADRs with owner-authorized body edits.
# Keep empty — projects override by modifying their installed copy.
KNOWN_EXCEPTIONS_G1: Set[str] = set()

REQUIRED_SECTIONS = [
    "Context",
    "Decision Drivers",
    ("Decision", "Decisions"),
    "Alternatives considered",
    "Consequences",
]


def parse_frontmatter(text: str) -> Dict[str, object]:
    if not text.startswith("---\n"):
        return {}

    end_marker = text.find("\n---\n", 4)
    if end_marker == -1:
        return {}

    block = text[4:end_marker]
    meta: Dict[str, object] = {}
    current_key: Optional[str] = None
    current_list: List[str] = []

    for raw_line in block.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if line.startswith("- ") and current_key is not None:
            current_list.append(line[2:].strip())
            continue

        if current_key is not None and current_list:
            meta[current_key] = current_list
            current_list = []
            current_key = None

        if ":" not in line:
            continue

        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        if value == "":
            current_key = key
            current_list = []
        elif value.startswith("[") and value.endswith("]"):
            items = [v.strip().strip('"').strip("'") for v in value[1:-1].split(",")]
            meta[key] = [v for v in items if v]
        else:
            meta[key] = value

    if current_key is not None and current_list:
        meta[current_key] = current_list

    return meta


def _has_section(text: str, heading) -> bool:
    if isinstance(heading, tuple):
        return any(_has_section(text, h) for h in heading)
    pattern = rf"^## {re.escape(heading)}\s*$"
    return bool(re.search(pattern, text, re.MULTILINE | re.IGNORECASE))


def extract_adr_id(filename: str) -> Optional[str]:
    match = re.match(r"(ADR-\d{4})", filename)
    return match.group(1) if match else None


def extract_adr_number(adr_id: str) -> int:
    return int(adr_id.split("-")[1])


def get_dependency_map_ids(cross_ref_text: str) -> Set[str]:
    ids: Set[str] = set()
    in_table = False
    for line in cross_ref_text.splitlines():
        if "## Dependency Map" in line:
            in_table = True
            continue
        if in_table and line.startswith("## "):
            break
        if in_table and line.startswith("|"):
            match = re.match(r"\|\s*(ADR-\d{4})\s*\|", line)
            if match:
                ids.add(match.group(1))
    return ids


def get_readme_sequence(readme_text: str) -> Optional[int]:
    match = re.search(r"Next available:\s*\*?\*?ADR-(\d{4})\*?\*?", readme_text)
    return int(match.group(1)) if match else None


def get_readme_proposed_ids(readme_text: str) -> Set[str]:
    ids: Set[str] = set()
    in_queue = False
    for line in readme_text.splitlines():
        if "## Current Approval Queue" in line:
            in_queue = True
            continue
        if in_queue and line.startswith("## "):
            break
        if in_queue:
            for match in re.finditer(r"ADR-\d{4}", line):
                ids.add(match.group())
    return ids


def run_check(mode: str, adr_dir: Path, cross_ref_file: Path, readme_file: Path) -> int:
    if not adr_dir.exists():
        print(f"ERROR: {adr_dir} not found", file=sys.stderr)
        sys.exit(2)

    adrs: Dict[str, Dict[str, object]] = {}
    adr_texts: Dict[str, str] = {}

    for path in sorted(adr_dir.glob("ADR-*.md")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        meta = parse_frontmatter(text)
        adr_id = extract_adr_id(path.name)
        if adr_id:
            adrs[adr_id] = meta
            adr_texts[adr_id] = text

    violations: List[str] = []

    # G1: Accepted ADRs have required sections
    for adr_id, meta in sorted(adrs.items()):
        if str(meta.get("status", "")) != "accepted":
            continue
        if adr_id in KNOWN_EXCEPTIONS_G1:
            continue
        text = adr_texts.get(adr_id, "")
        missing = []
        for section in REQUIRED_SECTIONS:
            if not _has_section(text, section):
                label = section if isinstance(section, str) else "/".join(section)
                missing.append(label)
        if missing:
            violations.append(
                f"  [G1-high] {adr_id}: accepted but missing sections: {', '.join(missing)}"
            )

    # G2: Every ADR has a Dependency Map line
    if cross_ref_file.exists():
        cross_ref_text = cross_ref_file.read_text(encoding="utf-8", errors="ignore")
        dep_map_ids = get_dependency_map_ids(cross_ref_text)
        for adr_id in sorted(adrs.keys()):
            if adr_id not in dep_map_ids:
                violations.append(
                    f"  [G2-medium] {adr_id}: not found in ADR-CROSS-REFERENCES.md Dependency Map"
                )
    else:
        violations.append(
            "  [G2-medium] ADR-CROSS-REFERENCES.md not found — cannot validate Dependency Map"
        )

    # G3: README sequence = highest ADR number + 1
    if readme_file.exists():
        readme_text = readme_file.read_text(encoding="utf-8", errors="ignore")
        readme_seq = get_readme_sequence(readme_text)
        if adrs:
            highest = max(extract_adr_number(aid) for aid in adrs)
            expected_seq = highest + 1
            if readme_seq is not None and readme_seq != expected_seq:
                violations.append(
                    f"  [G3-low] README.md sequence is ADR-{readme_seq:04d}, expected ADR-{expected_seq:04d}"
                )
    else:
        violations.append("  [G3-low] README.md not found — cannot validate sequence")

    # G4: README approval queue = proposed ADRs
    if readme_file.exists():
        readme_text = readme_file.read_text(encoding="utf-8", errors="ignore")
        proposed_ids = {
            aid for aid, m in adrs.items() if str(m.get("status", "")) == "proposed"
        }
        queue_ids = get_readme_proposed_ids(readme_text)

        queue_section_empty = (
            "(empty" in readme_text.split("## Current Approval Queue")[-1].split("##")[0]
            if "## Current Approval Queue" in readme_text
            else False
        )

        if proposed_ids and queue_section_empty:
            violations.append(
                f"  [G4-low] README.md approval queue says empty but proposed ADRs exist: "
                f"{', '.join(sorted(proposed_ids))}"
            )
        elif not proposed_ids and not queue_section_empty and queue_ids:
            violations.append(
                f"  [G4-low] README.md approval queue lists ADRs but none are proposed: "
                f"{', '.join(sorted(queue_ids))}"
            )
        elif proposed_ids != queue_ids and not queue_section_empty:
            missing_from_queue = proposed_ids - queue_ids
            extra_in_queue = queue_ids - proposed_ids
            if missing_from_queue:
                violations.append(
                    f"  [G4-low] README.md approval queue missing proposed ADRs: "
                    f"{', '.join(sorted(missing_from_queue))}"
                )
            if extra_in_queue:
                violations.append(
                    f"  [G4-low] README.md approval queue lists non-proposed ADRs: "
                    f"{', '.join(sorted(extra_in_queue))}"
                )

    print("\nADR GOVERNANCE CHECK", file=sys.stderr)
    print("=" * 40, file=sys.stderr)
    print(f"\nADRs scanned: {len(adrs)}", file=sys.stderr)

    if violations:
        print(f"\nFindings: {len(violations)}", file=sys.stderr)
        for v in violations:
            print(v, file=sys.stderr)
    else:
        print("\n0 findings", file=sys.stderr)

    if violations:
        if mode == "block":
            print(f"\nRESULT: FAIL ({len(violations)} findings)", file=sys.stderr)
            return 1
        else:
            print(f"\nRESULT: WARN ({len(violations)} findings, non-blocking)", file=sys.stderr)
            return 0

    print("\nRESULT: PASS", file=sys.stderr)
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Check ADR governance invariants")
    parser.add_argument(
        "--mode",
        choices=["warn", "block"],
        default="warn",
        help="warn = exit 0 with report; block = exit 1 on findings",
    )
    args = parser.parse_args()

    try:
        config_path = find_kdoc_config(Path.cwd())
    except FileNotFoundError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(2)

    root = config_path.parent
    config = load_kdoc_config(config_path)

    # Check if ADR area is enabled
    areas = config.get("areas", {})
    if isinstance(areas, dict):
        adr_conf = areas.get("adr", {})
        if isinstance(adr_conf, dict):
            if str(adr_conf.get("enabled", "true")).lower() == "false":
                print("ADR area is disabled — skipping governance check.", file=sys.stderr)
                sys.exit(0)

    knowledge_dir_name = str(config.get("root", "Knowledge"))
    knowledge_dir = root / knowledge_dir_name

    structure = _load_knowledge_structure(root)
    adr_dir_name = _adr_directory(structure)

    adr_dir = knowledge_dir / adr_dir_name
    cross_ref_file = adr_dir / "ADR-CROSS-REFERENCES.md"
    readme_file = adr_dir / "README.md"

    exit_code = run_check(args.mode, adr_dir, cross_ref_file, readme_file)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
