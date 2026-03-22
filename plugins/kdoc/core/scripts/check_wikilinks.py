#!/usr/bin/env python3
"""Validate internal wikilinks in Knowledge markdown files.

Scans all .md files under the Knowledge root for links in the form:
- [[TLDR/Area/feature]]
- [[TLDR/Area/feature|Display Text]]
- [[ADR/ADR-0001-title|ADR-0001]]

Reads configuration from .kdoc.yaml:
  root: Knowledge
  areas:
    tldr: { enabled: true }
    adr:  { enabled: true }

Usage:
    python3 check_wikilinks.py
"""

import difflib
import re
import sys
from pathlib import Path
from typing import Optional


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


def _area_enabled(config: dict, area: str) -> bool:
    areas = config.get("areas", {})
    if not isinstance(areas, dict):
        return True
    area_conf = areas.get(area, {})
    if isinstance(area_conf, dict):
        return str(area_conf.get("enabled", "true")).lower() != "false"
    return True


def _area_directory(config: dict, area: str, default: str) -> str:
    """Get directory name for an area from config (areas.<name>.directory) or default."""
    areas = config.get("areas", {})
    if isinstance(areas, dict):
        area_conf = areas.get(area, {})
        if isinstance(area_conf, dict):
            return str(area_conf.get("directory", default))
    return default


# ---------------------------------------------------------------------------
# Wikilink validation (generalized from AVShop2/scripts/check_knowledge_wikilinks.py)
# ---------------------------------------------------------------------------

WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")
MARKDOWN_LINK_RE = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
WINDOWS_ABSOLUTE_RE = re.compile(r"^[A-Za-z]:[\\/]")
LOCAL_ABSOLUTE_PREFIXES = ("file://", "/Users/", "/home/", "/private/", "/var/", "/tmp/")


def suggest_similar(target_path: Path, *, max_results: int = 3, cutoff: float = 0.6) -> list:
    parent = target_path.parent
    if not parent.is_dir():
        return []
    target_stem = target_path.stem.lower()
    candidates = [p.stem for p in parent.glob("*.md")]
    matches = difflib.get_close_matches(
        target_stem, [c.lower() for c in candidates], n=max_results, cutoff=cutoff
    )
    lower_to_original = {c.lower(): c for c in candidates}
    return [lower_to_original[m] for m in matches if m in lower_to_original]


def is_example_link(target: str) -> bool:
    return ("<" in target and ">" in target) or ("{{" in target and "}}" in target)


def normalize_target(raw_target: str, current_file: Path, knowledge_dir: Path) -> Optional[Path]:
    target = raw_target.strip()
    if not target:
        return None

    target = re.split(r"\\?\|", target, maxsplit=1)[0]
    target = target.split("#", 1)[0].strip()
    if not target:
        return None

    if is_example_link(target):
        return None

    has_extension = target.lower().endswith(".md")
    candidate = f"{target}.md" if not has_extension else target

    first_segment = target.split("/", 1)[0]
    if (knowledge_dir / first_segment).is_dir():
        return knowledge_dir / candidate

    if (knowledge_dir / candidate).exists():
        return knowledge_dir / candidate

    return current_file.parent / candidate


def normalize_markdown_link_target(raw_target: str) -> str:
    target = raw_target.strip()
    if not target:
        return ""
    if " " in target:
        target = target.split(" ", 1)[0]
    return target.strip("<>")


def is_local_absolute_markdown_link(raw_target: str) -> bool:
    target = normalize_markdown_link_target(raw_target)
    if not target:
        return False
    if target.startswith(("#", "http://", "https://", "mailto:")):
        return False
    if WINDOWS_ABSOLUTE_RE.match(target):
        return True
    return target.startswith(LOCAL_ABSOLUTE_PREFIXES)


def main() -> int:
    try:
        config_path = find_kdoc_config(Path.cwd())
    except FileNotFoundError as e:
        print(f"ERROR: {e}")
        return 2

    root = config_path.parent
    config = load_kdoc_config(config_path)

    knowledge_dir_name = str(config.get("root", "Knowledge"))
    knowledge_dir = root / knowledge_dir_name

    if not knowledge_dir.exists():
        print(f"ERROR: Knowledge directory not found: {knowledge_dir}")
        return 2

    tldr_dir_name = _area_directory(config, "tldr", "TLDR")
    tldr_dir = knowledge_dir / tldr_dir_name

    if _area_enabled(config, "tldr") and not tldr_dir.exists():
        print(f"ERROR: Missing directory: {tldr_dir}")
        return 2

    missing: list = []
    absolute_links: list = []

    scanned_files = sorted(knowledge_dir.rglob("*.md"))

    for file_path in scanned_files:
        lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()

        for line_number, line in enumerate(lines, start=1):
            for match in WIKILINK_RE.finditer(line):
                raw = match.group(1)
                target_path = normalize_target(raw, file_path, knowledge_dir)
                if target_path is None:
                    continue
                if not target_path.exists():
                    msg = (
                        f"{file_path.relative_to(root)}:{line_number} -> [[{raw}]] "
                        f"(missing: {target_path.relative_to(root)})"
                    )
                    suggestions = suggest_similar(target_path)
                    if suggestions:
                        msg += f" — did you mean: {', '.join(suggestions)}?"
                    missing.append(msg)

            for match in MARKDOWN_LINK_RE.finditer(line):
                raw_target = match.group(1)
                if is_local_absolute_markdown_link(raw_target):
                    absolute_links.append(
                        f"{file_path.relative_to(root)}:{line_number} -> ({normalize_markdown_link_target(raw_target)})"
                    )

    if missing or absolute_links:
        if missing:
            print("Broken wikilinks found:")
            for item in missing:
                print(f"- {item}")
        if absolute_links:
            if missing:
                print()
            print("Local absolute markdown links found:")
            for item in absolute_links:
                print(f"- {item}")
            print("  Fix: use wikilinks for Knowledge targets or relative markdown links for repo files.")
        total_issues = len(missing) + len(absolute_links)
        print(f"\nChecked {len(scanned_files)} files. Total issues: {total_issues}")
        return 1

    print(f"OK: checked {len(scanned_files)} files. No broken wikilinks found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
