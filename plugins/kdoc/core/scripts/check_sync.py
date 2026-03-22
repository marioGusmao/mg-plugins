#!/usr/bin/env python3
"""Validate that functional code changes have corresponding Knowledge updates.

Reads configuration from .kdoc.yaml:
  root: Knowledge                    # Knowledge directory name
  governance:
    enforced-paths:                  # Patterns for functional code (glob-style, compiled to regex)
      - apps/*/src/modules/
      - apps/*/src/core/
      - packages/*/src/
    code-extensions:                 # File extensions to treat as functional code (default: .ts .tsx)
      - .ts
      - .tsx

Usage:
    python3 check_sync.py                    # auto: worktree local, branch diff in CI
    python3 check_sync.py --worktree
    python3 check_sync.py --staged
    python3 check_sync.py --base origin/main --head HEAD
    python3 check_sync.py --allow-no-knowledge-impact
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple


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
    """Parse the subset of YAML used by .kdoc.yaml — no external dependencies."""
    result: dict = {}
    stack: List[Tuple[int, dict]] = [(0, result)]

    for raw_line in text.splitlines():
        if not raw_line.strip() or raw_line.strip().startswith("#"):
            continue

        indent = len(raw_line) - len(raw_line.lstrip())
        line = raw_line.strip()

        # Unwind stack to current indentation level
        while len(stack) > 1 and stack[-1][0] >= indent:
            stack.pop()

        current_dict = stack[-1][1]

        if line.startswith("- "):
            # List item
            value = line[2:].strip().strip('"').strip("'")
            # Find the list key in current_dict (last key assigned as list)
            if "_current_list_key" in current_dict:
                key = current_dict["_current_list_key"]
                current_dict.setdefault(key, []).append(value)
            continue

        if ":" in line:
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if value == "":
                # Could be a mapping or list start
                nested: dict = {}
                current_dict[key] = nested
                current_dict["_current_list_key"] = key
                stack.append((indent + 2, nested))
            else:
                current_dict[key] = value
                current_dict["_current_list_key"] = key

    # Clean up internal markers
    def _clean(d: dict) -> dict:
        return {k: (_clean(v) if isinstance(v, dict) else v) for k, v in d.items() if k != "_current_list_key"}

    return _clean(result)


def load_kdoc_config(config_path: Path) -> dict:
    """Load and parse .kdoc.yaml."""
    text = config_path.read_text(encoding="utf-8", errors="ignore")
    return _parse_simple_yaml(text)


# ---------------------------------------------------------------------------
# Core logic (generalized from AVShop2/scripts/check_knowledge_sync.py)
# ---------------------------------------------------------------------------

TEST_PATTERNS = re.compile(
    r"\.(test|spec)\.(ts|tsx|js|jsx|py)$"
    r"|/__tests__/"
    r"|/tests/"
    r"|\.stories\.(ts|tsx|js|jsx)$"
)

AreaKey = Tuple[str, str]


def parse_frontmatter(text: str) -> Dict[str, object]:
    """Parse YAML frontmatter — pure Python, no PyYAML."""
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


def normalize_paths_field(value: object) -> List[str]:
    if isinstance(value, list):
        return [str(item).strip().rstrip("/") for item in value if str(item).strip()]
    if isinstance(value, str):
        if not value.strip():
            return []
        if "," in value:
            return [item.strip().rstrip("/") for item in value.split(",") if item.strip()]
        return [value.strip().rstrip("/")]
    return []


def extract_package_name(path: str) -> Optional[str]:
    m = re.match(r"^packages/([^/]+)/", path)
    return m.group(1) if m else None


def glob_to_regex(pattern: str) -> re.Pattern:
    """Convert a glob-style enforced-path pattern to a compiled regex."""
    # Patterns end with / meaning "match any file under this directory"
    # Escape everything, then restore * wildcards
    escaped = re.escape(pattern)
    # re.escape converts * to \*, restore as [^/]+ or .*
    # ** -> any path segments
    escaped = escaped.replace(r"\*\*", ".*")
    escaped = escaped.replace(r"\*", "[^/]+")
    # Anchor at start of string
    return re.compile(r"^" + escaped)


def get_changed_files(*, staged: bool, base: Optional[str], head: Optional[str], root: Path) -> List[str]:
    if staged:
        cmd = ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"]
    else:
        if not base or not head:
            raise ValueError("--base and --head are required in CI mode")
        cmd = ["git", "diff", "--name-only", "--diff-filter=ACMR", f"{base}...{head}"]

    result = subprocess.run(cmd, capture_output=True, text=True, cwd=root)
    if result.returncode != 0:
        print(f"ERROR: git diff failed: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(2)

    return [f for f in result.stdout.strip().splitlines() if f]


def get_changed_files_worktree(root: Path) -> List[str]:
    tracked = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=ACMR", "HEAD"],
        capture_output=True, text=True, cwd=root
    )
    if tracked.returncode != 0:
        print(f"ERROR: git diff failed: {tracked.stderr.strip()}", file=sys.stderr)
        sys.exit(2)

    untracked = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard"],
        capture_output=True, text=True, cwd=root
    )
    if untracked.returncode != 0:
        print(f"ERROR: git ls-files failed: {untracked.stderr.strip()}", file=sys.stderr)
        sys.exit(2)

    changed = [f for f in tracked.stdout.strip().splitlines() if f]
    changed.extend(f for f in untracked.stdout.strip().splitlines() if f)

    deduped: List[str] = []
    seen: Set[str] = set()
    for item in changed:
        if item not in seen:
            deduped.append(item)
            seen.add(item)
    return deduped


def is_functional(filepath: str, code_extensions: Set[str], functional_patterns: List[re.Pattern]) -> bool:
    p = Path(filepath)
    if p.suffix not in code_extensions:
        return False
    if TEST_PATTERNS.search(filepath):
        return False
    return any(pat.search(filepath) for pat in functional_patterns)


def is_knowledge(filepath: str, knowledge_dir_name: str) -> bool:
    return filepath.startswith(knowledge_dir_name + "/")


def extract_area_key(filepath: str) -> Optional[AreaKey]:
    m = re.match(r"^apps/([^/]+)/src/modules/([^/]+)/", filepath)
    if m:
        return ("module", f"{m.group(1)}/{m.group(2)}")

    m = re.match(r"^apps/([^/]+)/src/app/api/(.+?)(?:/[^/]+)?$", filepath)
    if m:
        api_dir = str(Path(filepath).parent)
        return ("api", api_dir)

    m = re.match(r"^apps/([^/]+)/src/core/", filepath)
    if m:
        return ("core", str(Path(filepath).parent))

    m = re.match(r"^packages/([^/]+)/src/", filepath)
    if m:
        return ("package", filepath)

    return None


def load_tldr_index(tldr_dir: Path) -> List[Tuple[Path, Dict[str, object]]]:
    index: List[Tuple[Path, Dict[str, object]]] = []
    if not tldr_dir.exists():
        return index

    for path in sorted(tldr_dir.rglob("*.md")):
        rel = path.relative_to(tldr_dir)
        if rel.parts[0] in ("README.md",) or path.name.startswith("_"):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        meta = parse_frontmatter(text)
        if meta:
            index.append((path, meta))

    return index


def find_tldr_for_area(
    area_key: AreaKey,
    tldr_index: List[Tuple[Path, Dict[str, object]]],
    root: Path,
) -> List[str]:
    kind, identifier = area_key
    matches: List[str] = []

    for path, meta in tldr_index:
        rel_to_root = path.relative_to(root)

        if kind == "module":
            app, module_name = identifier.split("/", 1)
            module_paths = normalize_paths_field(meta.get("module_path", ""))
            target_module_path = f"apps/{app}/src/modules/{module_name}"
            for module_path in module_paths:
                if module_path == target_module_path:
                    matches.append(str(rel_to_root))
                    break

        elif kind == "api":
            api_paths = normalize_paths_field(meta.get("api_paths", []))
            for ap in api_paths:
                if identifier.startswith(ap) or identifier == ap:
                    matches.append(str(rel_to_root))
                    break

        elif kind == "core":
            core_paths = normalize_paths_field(meta.get("core_paths", []))
            for core_path in core_paths:
                if identifier == core_path or identifier.startswith(f"{core_path}/"):
                    matches.append(str(rel_to_root))
                    break

        elif kind == "package":
            package_paths = normalize_paths_field(meta.get("package_paths", []))
            if package_paths:
                for package_path in package_paths:
                    if identifier == package_path or identifier.startswith(f"{package_path}/"):
                        matches.append(str(rel_to_root))
                        break
                continue

            package_name = extract_package_name(identifier)
            if not package_name:
                continue

            for package_path in normalize_paths_field(meta.get("package_path", "")):
                if (
                    package_path == f"packages/{package_name}"
                    or package_path.endswith(f"packages/{package_name}")
                ):
                    matches.append(str(rel_to_root))
                    break

    return matches


def run_check(
    changed_files: List[str],
    allow_no_knowledge_impact: bool,
    root: Path,
    knowledge_dir_name: str,
    code_extensions: Set[str],
    functional_patterns: List[re.Pattern],
) -> int:
    knowledge_dir = root / knowledge_dir_name
    tldr_dir = knowledge_dir / "TLDR"

    functional_files: List[str] = []
    knowledge_files_changed: Set[str] = set()

    for f in changed_files:
        if is_functional(f, code_extensions, functional_patterns):
            functional_files.append(f)
        if is_knowledge(f, knowledge_dir_name):
            knowledge_files_changed.add(f)

    if not functional_files:
        print("\nKNOWLEDGE SYNC CHECK", file=sys.stderr)
        print("=" * 40, file=sys.stderr)
        print("\nNo functional code files detected.", file=sys.stderr)
        print("\nRESULT: PASS", file=sys.stderr)
        return 0

    area_keys: Set[AreaKey] = set()
    for f in functional_files:
        key = extract_area_key(f)
        if key:
            area_keys.add(key)

    tldr_index = load_tldr_index(tldr_dir)

    mapped_areas: Dict[AreaKey, List[str]] = {}
    unmapped_areas: Set[AreaKey] = set()

    for key in sorted(area_keys):
        tldr_paths = find_tldr_for_area(key, tldr_index, root)
        if tldr_paths:
            mapped_areas[key] = tldr_paths
        else:
            if key[0] == "core":
                continue
            unmapped_areas.add(key)

    knowledge_needed: Set[str] = set()
    for paths in mapped_areas.values():
        knowledge_needed.update(paths)

    adr_changed = any(f.startswith(f"{knowledge_dir_name}/ADR/") for f in knowledge_files_changed)
    missing_tldrs = knowledge_needed - knowledge_files_changed
    coherence_pass = (len(missing_tldrs) == 0) or adr_changed

    print("\nKNOWLEDGE SYNC CHECK", file=sys.stderr)
    print("=" * 40, file=sys.stderr)
    print("\nFunctional files detected:", file=sys.stderr)
    for f in sorted(functional_files):
        print(f"  - {f}", file=sys.stderr)

    if knowledge_needed:
        print("\nExpected TLDR documents:", file=sys.stderr)
        for key in sorted(mapped_areas.keys()):
            for p in mapped_areas[key]:
                label = f"{key[0]}: {key[1]}"
                print(f"  - {p} ({label})", file=sys.stderr)

    if unmapped_areas:
        print("\nUnmapped areas (no TLDR found):", file=sys.stderr)
        for key in sorted(unmapped_areas):
            print(f"  - {key[0]}: {key[1]}", file=sys.stderr)

    if knowledge_files_changed:
        print("\nKnowledge files changed in this diff:", file=sys.stderr)
        for f in sorted(knowledge_files_changed):
            marker = "" if f in knowledge_needed else " <- NOT in expected set"
            print(f"  - {f}{marker}", file=sys.stderr)

    if unmapped_areas:
        print("\nRESULT: FAIL", file=sys.stderr)
        print("  - Add TLDR documents for the unmapped areas listed above", file=sys.stderr)
        return 1

    if not knowledge_needed:
        print("\nRESULT: PASS (no mapped areas requiring updates)", file=sys.stderr)
        return 0

    if allow_no_knowledge_impact:
        print("\nRESULT: PASS (no-knowledge-impact exception)", file=sys.stderr)
        return 0

    if not coherence_pass:
        print(f"\nCoherence check: FAIL", file=sys.stderr)
        print(f"  Missing:  {{{', '.join(sorted(missing_tldrs))}}}", file=sys.stderr)
        print("\nRESULT: FAIL", file=sys.stderr)
        return 1

    print("\nCoherence check: PASS", file=sys.stderr)
    print("\nRESULT: PASS", file=sys.stderr)
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Check Knowledge sync with code changes")
    parser.add_argument("--worktree", action="store_true")
    parser.add_argument("--staged", action="store_true")
    parser.add_argument("--base", help="Base ref for CI mode (e.g. origin/main)")
    parser.add_argument("--head", help="Head ref for CI mode (e.g. HEAD)")
    parser.add_argument("--allow-no-knowledge-impact", action="store_true")
    args = parser.parse_args()

    try:
        config_path = find_kdoc_config(Path.cwd())
    except FileNotFoundError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(2)

    root = config_path.parent
    config = load_kdoc_config(config_path)

    knowledge_dir_name = str(config.get("root", "Knowledge"))

    governance = config.get("governance", {})
    if isinstance(governance, dict):
        enforced_paths = governance.get("enforced-paths", [])
        ext_list = governance.get("code-extensions", [".ts", ".tsx"])
    else:
        enforced_paths = []
        ext_list = [".ts", ".tsx"]

    if not isinstance(enforced_paths, list):
        enforced_paths = []
    if not isinstance(ext_list, list):
        ext_list = [".ts", ".tsx"]

    code_extensions = set(ext_list) if ext_list else {".ts", ".tsx"}
    functional_patterns = [glob_to_regex(p) for p in enforced_paths]

    if args.staged:
        changed_files = get_changed_files(staged=True, base=None, head=None, root=root)
    elif args.worktree:
        changed_files = get_changed_files_worktree(root)
    elif args.base or args.head:
        if not (args.base and args.head):
            parser.error("--base and --head are required together")
        changed_files = get_changed_files(staged=False, base=args.base, head=args.head, root=root)
    else:
        env_base = os.getenv("BASE_REF")
        env_head = os.getenv("HEAD_REF")
        if env_base and env_head:
            changed_files = get_changed_files(staged=False, base=env_base, head=env_head, root=root)
        elif os.getenv("CI", "").lower() == "true":
            changed_files = get_changed_files(staged=False, base="origin/main", head="HEAD", root=root)
        else:
            changed_files = get_changed_files_worktree(root)

    exit_code = run_check(
        changed_files,
        args.allow_no_knowledge_impact,
        root,
        knowledge_dir_name,
        code_extensions,
        functional_patterns,
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
