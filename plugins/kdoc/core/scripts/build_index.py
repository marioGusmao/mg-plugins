#!/usr/bin/env python3
"""Build a lightweight Knowledge/INDEX.md for quick navigation.

Reads configuration from .kdoc.yaml:
  root: Knowledge    # Knowledge directory

Usage:
    python3 build_index.py
"""

import re
import sys
from dataclasses import dataclass, field
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


def _load_knowledge_structure(root: Path) -> dict:
    """Load core/schema/knowledge-structure.json for area directory mappings."""
    # Search for knowledge-structure.json relative to this script or the config
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


def _templates_dir_name(structure: dict) -> str:
    """Get the directory name for the templates area."""
    areas = structure.get("areas", {})
    if isinstance(areas, dict):
        templates_area = areas.get("templates", {})
        if isinstance(templates_area, dict):
            return str(templates_area.get("directory", "Templates"))
    return "Templates"


# ---------------------------------------------------------------------------
# Index building (generalized from AVShop2/scripts/build_knowledge_index.py)
# ---------------------------------------------------------------------------

VALID_STATUSES = {"draft", "in_progress", "ready", "done", "blocked", "deprecated"}


@dataclass
class FileRow:
    relative_path: str
    note_type: str = ""
    area: str = ""
    status: str = ""
    tags: List[str] = field(default_factory=list)
    summary: str = ""
    open_questions: Optional[int] = None
    tests_status: str = ""
    acceptance_status: str = ""


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


def _get_section(text: str, heading: str) -> Optional[str]:
    pattern = rf"^## {re.escape(heading)}\s*$"
    match = re.search(pattern, text, re.MULTILINE)
    if not match:
        return None
    start = match.end()
    next_heading = re.search(r"^## ", text[start:], re.MULTILINE)
    if next_heading:
        return text[start: start + next_heading.start()]
    return text[start:]


def count_open_questions(text: str) -> Optional[int]:
    section = _get_section(text, "Open Questions")
    if section is None:
        return None

    count = 0
    for line in section.splitlines():
        stripped = line.strip()
        if not stripped.startswith("- "):
            continue
        content = stripped[2:].strip()
        if content.startswith("~~") and "~~" in content[2:]:
            continue
        if content.lower().startswith("(none"):
            continue
        if not content:
            continue
        count += 1

    return count


def check_test_scenarios(text: str) -> str:
    section = _get_section(text, "Test Scenarios")
    if section is None:
        return ""

    rows = [
        line.strip()
        for line in section.splitlines()
        if line.strip().startswith("|") and not re.match(r'\|[\s-]+\|', line.strip())
    ]

    data_rows = rows[1:] if len(rows) > 1 else []

    for row in data_rows:
        cells = [c.strip() for c in row.split("|")]
        cells = [c for c in cells if c]
        content_cells = [c for c in cells if c not in ("Unit", "Component", "Integration", "E2E")]
        if any(content_cells):
            return "ok"

    return "empty"


def check_acceptance_criteria(text: str) -> str:
    section = _get_section(text, "Acceptance Criteria")
    if section is None:
        return ""

    for line in section.splitlines():
        stripped = line.strip()
        if not (stripped.startswith("- [ ]") or stripped.startswith("- [x]")):
            continue
        after_checkbox = stripped[5:].strip()
        if after_checkbox:
            return "ok"

    return "empty"


def collect_rows(knowledge_dir: Path, templates_dir_name: str) -> List[FileRow]:
    rows: List[FileRow] = []

    for path in sorted(knowledge_dir.rglob("*.md")):
        relative_to_knowledge = path.relative_to(knowledge_dir)
        if templates_dir_name in relative_to_knowledge.parts:
            continue
        if path.name.startswith("._"):
            continue

        text = path.read_text(encoding="utf-8", errors="ignore")
        meta = parse_frontmatter(text)

        tags_raw = meta.get("tags", [])
        tags = tags_raw if isinstance(tags_raw, list) else []

        row = FileRow(
            relative_path=str(relative_to_knowledge),
            note_type=str(meta.get("type", "")),
            area=str(meta.get("area", "")),
            status=str(meta.get("status", "")),
            tags=tags,
            summary=str(meta.get("summary", "")),
        )

        is_tldr = str(relative_to_knowledge).startswith("TLDR/")
        if is_tldr and row.status and row.status not in VALID_STATUSES:
            print(
                f"ERROR: {relative_to_knowledge} has invalid status '{row.status}'. "
                f"Valid values: {', '.join(sorted(VALID_STATUSES))}"
            )
            raise SystemExit(1)

        if row.note_type == "feature":
            oq = count_open_questions(text)
            row.open_questions = oq if oq and oq > 0 else 0
            row.tests_status = check_test_scenarios(text)
            row.acceptance_status = check_acceptance_criteria(text)

        rows.append(row)

    return rows


def _normalize_table_cell(value: str) -> str:
    collapsed = re.sub(r"\s+", " ", value.strip())
    return collapsed.replace("|", "\\|")


def _build_markdown_table(headers: List[str], rows: List[List[str]]) -> List[str]:
    widths = [len(h) for h in headers]

    for row in rows:
        for idx, cell in enumerate(row):
            widths[idx] = max(widths[idx], len(cell))

    def format_row(cells: List[str]) -> str:
        padded = [cells[idx].ljust(widths[idx]) for idx in range(len(headers))]
        return f"| {' | '.join(padded)} |"

    separator = f"| {' | '.join('-' * width for width in widths)} |"

    lines: List[str] = [format_row(headers), separator]
    for row in rows:
        lines.append(format_row(row))
    return lines


def build_index(rows: List[FileRow]) -> str:
    lines: List[str] = []
    lines.append("# Knowledge - INDEX")
    lines.append("")
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines.append(f"> Generated by `kdoc:build:index` on {timestamp}. Do not edit manually.")
    lines.append("")
    headers = ["File", "type", "area", "status", "open_qs", "tests", "acceptance", "summary"]
    table_rows: List[List[str]] = []

    feature_count = 0
    with_open_qs = 0
    with_empty_tests = 0
    with_empty_acceptance = 0
    ready_count = 0
    done_count = 0

    for row in rows:
        link = f"[{row.relative_path}](./{row.relative_path})"

        oq_str = ""
        tests_str = ""
        acceptance_str = ""

        if row.note_type == "feature":
            feature_count += 1
            oq_str = str(row.open_questions) if row.open_questions else ""
            tests_str = row.tests_status
            acceptance_str = row.acceptance_status

            has_oq = row.open_questions is not None and row.open_questions > 0
            has_test_gap = row.tests_status == "empty"
            has_acceptance_gap = row.acceptance_status == "empty"

            if has_oq:
                with_open_qs += 1
            if has_test_gap:
                with_empty_tests += 1
            if has_acceptance_gap:
                with_empty_acceptance += 1
            if row.status == "done":
                done_count += 1
            has_status_gap = row.status not in ("ready", "done")
            if not has_oq and not has_test_gap and not has_acceptance_gap and not has_status_gap:
                ready_count += 1

        table_rows.append(
            [
                _normalize_table_cell(link),
                _normalize_table_cell(row.note_type),
                _normalize_table_cell(row.area),
                _normalize_table_cell(row.status),
                _normalize_table_cell(oq_str),
                _normalize_table_cell(tests_str),
                _normalize_table_cell(acceptance_str),
                _normalize_table_cell(row.summary),
            ]
        )

    lines.extend(_build_markdown_table(headers, table_rows))

    lines.append("")
    lines.append("## Readiness Summary")
    lines.append("")
    lines.append(f"- Features with open questions: {with_open_qs}/{feature_count}")
    lines.append(f"- Features with empty test scenarios: {with_empty_tests}/{feature_count}")
    lines.append(f"- Features with empty acceptance criteria: {with_empty_acceptance}/{feature_count}")
    lines.append(f"- Features done: {done_count}/{feature_count}")
    lines.append(f"- Features ready for implementation (no gaps): {ready_count}/{feature_count}")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    try:
        config_path = find_kdoc_config(Path.cwd())
    except FileNotFoundError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(2)

    root = config_path.parent
    config = load_kdoc_config(config_path)

    knowledge_dir_name = str(config.get("root", "Knowledge"))
    knowledge_dir = root / knowledge_dir_name

    if not knowledge_dir.exists():
        print(f"ERROR: Knowledge directory not found: {knowledge_dir}", file=sys.stderr)
        sys.exit(2)

    structure = _load_knowledge_structure(root)
    templates_dir_name = _templates_dir_name(structure)

    output_file = knowledge_dir / "INDEX.md"
    rows = collect_rows(knowledge_dir, templates_dir_name)
    content = build_index(rows)

    previous = output_file.read_text(encoding="utf-8") if output_file.exists() else None
    if previous == content:
        print(f"No changes in {output_file}")
        return

    output_file.write_text(content, encoding="utf-8")
    print(f"Wrote {output_file}")


if __name__ == "__main__":
    main()
