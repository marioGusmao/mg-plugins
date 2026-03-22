#!/usr/bin/env bash
# check_module_deps.sh — Validate Swift Package Manager module dependencies
#
# Usage: ./scripts/kdoc/swift-ios/check_module_deps.sh [--project-root <path>]
#
# Rules enforced:
#   1. Local packages must not import application targets.
#   2. Feature modules must not directly import other feature modules
#      (they communicate through Core/Navigation or a coordinator).
#   3. All targets declared in Package.swift files must be discoverable
#      (no ghost declarations).
#
# Exit codes: 0 = pass, 1 = violations found, 2 = usage error

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PROJECT_ROOT="${1:-$(pwd)}"
PACKAGES_DIR="${PROJECT_ROOT}/Packages"
SOURCES_DIR="${PROJECT_ROOT}/Sources"
VIOLATIONS=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

pass()  { echo -e "${GREEN}[PASS]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*"; VIOLATIONS=$((VIOLATIONS + 1)); }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
info()  { echo "       $*"; }

# ---------------------------------------------------------------------------
# Rule 1: Local packages must not import application targets
# ---------------------------------------------------------------------------

echo ""
echo "Rule 1: Local packages must not import application targets"
echo "----------------------------------------------------------"

if [ ! -d "${PACKAGES_DIR}" ]; then
    warn "No Packages/ directory found — skipping Rule 1."
else
    # Collect application target names from Sources/ subdirectories
    APP_TARGETS=()
    if [ -d "${SOURCES_DIR}" ]; then
        while IFS= read -r dir; do
            APP_TARGETS+=("$(basename "$dir")")
        done < <(find "${SOURCES_DIR}" -mindepth 1 -maxdepth 1 -type d)
    fi

    if [ ${#APP_TARGETS[@]} -eq 0 ]; then
        warn "No application targets found in Sources/ — skipping Rule 1."
    else
        # Search for imports of application targets inside Packages/
        for target in "${APP_TARGETS[@]}"; do
            matches=$(grep -r --include="*.swift" "import ${target}" "${PACKAGES_DIR}" 2>/dev/null || true)
            if [ -n "$matches" ]; then
                fail "Package imports application target '${target}':"
                echo "$matches" | while IFS= read -r line; do info "$line"; done
            fi
        done
        [ $VIOLATIONS -eq 0 ] && pass "No local packages import application targets."
    fi
fi

# ---------------------------------------------------------------------------
# Rule 2: Feature modules must not directly import sibling feature modules
# ---------------------------------------------------------------------------

echo ""
echo "Rule 2: Feature modules must not directly import sibling feature modules"
echo "-------------------------------------------------------------------------"

MODULES_VIOLATIONS_BEFORE=$VIOLATIONS

if [ ! -d "${SOURCES_DIR}" ]; then
    warn "No Sources/ directory found — skipping Rule 2."
else
    # Find all Modules directories
    while IFS= read -r modules_dir; do
        target_name=$(basename "$(dirname "$modules_dir")")
        # Get list of feature module names
        module_names=()
        while IFS= read -r mod; do
            module_names+=("$(basename "$mod")")
        done < <(find "$modules_dir" -mindepth 1 -maxdepth 1 -type d)

        # For each module, check if it imports another sibling module
        for module in "${module_names[@]}"; do
            module_path="${modules_dir}/${module}"
            for sibling in "${module_names[@]}"; do
                [ "$module" = "$sibling" ] && continue
                matches=$(grep -r --include="*.swift" "import ${sibling}" "${module_path}" 2>/dev/null || true)
                if [ -n "$matches" ]; then
                    fail "Feature module '${module}' (in ${target_name}) imports sibling module '${sibling}':"
                    echo "$matches" | while IFS= read -r line; do info "$line"; done
                fi
            done
        done
    done < <(find "${SOURCES_DIR}" -type d -name "Modules")

    [ $VIOLATIONS -eq $MODULES_VIOLATIONS_BEFORE ] && pass "No direct sibling feature module imports detected."
fi

# ---------------------------------------------------------------------------
# Rule 3: All targets in Package.swift files must have a corresponding source directory
# ---------------------------------------------------------------------------

echo ""
echo "Rule 3: Package.swift target declarations match source directories"
echo "-------------------------------------------------------------------"

TARGETS_VIOLATIONS_BEFORE=$VIOLATIONS

while IFS= read -r pkg_file; do
    pkg_dir=$(dirname "$pkg_file")
    # Extract .target and .testTarget names (simple grep — not a full Swift parser)
    declared=$(grep -E '\.target\(|\.testTarget\(' "$pkg_file" \
        | grep -oE 'name:\s*"[^"]+"' \
        | grep -oE '"[^"]+"' \
        | tr -d '"' || true)

    for target_name in $declared; do
        # Source directories can be Sources/<name>/ or Tests/<name>/
        found=false
        for candidate in "${pkg_dir}/Sources/${target_name}" "${pkg_dir}/Tests/${target_name}"; do
            [ -d "$candidate" ] && found=true && break
        done
        if [ "$found" = false ]; then
            fail "Target '${target_name}' declared in ${pkg_file} has no source directory."
        fi
    done
done < <(find "${PROJECT_ROOT}" -name "Package.swift" -not -path "*/checkouts/*" -not -path "*/.build/*")

[ $VIOLATIONS -eq $TARGETS_VIOLATIONS_BEFORE ] && pass "All Package.swift targets have matching source directories."

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo "================================================================"
if [ $VIOLATIONS -eq 0 ]; then
    echo -e "${GREEN}All checks passed.${NC}"
    exit 0
else
    echo -e "${RED}${VIOLATIONS} violation(s) found. Fix before merging.${NC}"
    exit 1
fi
