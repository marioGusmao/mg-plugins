#!/usr/bin/env tsx
/**
 * check_route_contracts.ts
 *
 * Validates that Next.js Route Handlers in enforced API paths declare a
 * `responseSchema` (Zod schema) for contract enforcement.
 *
 * Usage:
 *   npx tsx scripts/kdoc/nextjs/check_route_contracts.ts
 *   npx tsx scripts/kdoc/nextjs/check_route_contracts.ts --dry-run
 *
 * Reads .kdoc.yaml to determine enforced paths.
 * Exits 0 if all route handlers have contracts, 1 if violations found.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { parse as parseYaml } from "yaml";
import fg from "fast-glob";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KdocConfig {
  root?: string;
  governance?: {
    "enforced-paths"?: string[];
  };
}

interface Violation {
  file: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

function loadConfig(cwd: string): KdocConfig {
  const configPath = join(cwd, ".kdoc.yaml");
  if (!existsSync(configPath)) {
    console.warn("[check_route_contracts] .kdoc.yaml not found — using defaults.");
    return {};
  }
  return parseYaml(readFileSync(configPath, "utf8")) as KdocConfig;
}

function resolveApiGlobs(config: KdocConfig, cwd: string): string[] {
  const enforcedPaths = config.governance?.["enforced-paths"] ?? [
    "apps/*/src/app/api/",
  ];

  // Convert enforced-paths entries that look like app/api paths into route globs.
  // Only paths containing "app/api" are relevant for route contract checking.
  const apiPaths = enforcedPaths.filter((p) => p.includes("app/api"));

  if (apiPaths.length === 0) {
    // Fall back to common default if none of the enforced-paths are API paths.
    return ["apps/*/src/app/api/**/route.ts"];
  }

  return apiPaths.map((p) => {
    // Normalise: strip trailing slash, append the route file glob.
    const base = p.replace(/\/$/, "");
    return `${base}/**/route.ts`;
  });
}

// ---------------------------------------------------------------------------
// Contract detection
// ---------------------------------------------------------------------------

const RESPONSE_SCHEMA_PATTERN = /responseSchema\s*[:=]/;
const HANDLER_PATTERN = /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/;

function checkFile(filePath: string): Violation | null {
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    return { file: filePath, reason: "Could not read file" };
  }

  // Only check files that actually export a route handler method.
  if (!HANDLER_PATTERN.test(content)) {
    return null; // Not a route handler — skip.
  }

  if (!RESPONSE_SCHEMA_PATTERN.test(content)) {
    return {
      file: filePath,
      reason: "No `responseSchema` declaration found. Route handlers must declare a Zod response schema for contract enforcement.",
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const cwd = process.cwd();

  const config = loadConfig(cwd);
  const globs = resolveApiGlobs(config, cwd);

  console.log("[check_route_contracts] Scanning route handlers...");
  if (dryRun) console.log("[check_route_contracts] Dry-run mode — no exit code enforcement.");

  const files = await fg(globs, { cwd, absolute: true });

  if (files.length === 0) {
    console.log("[check_route_contracts] No route files found. Nothing to check.");
    process.exit(0);
  }

  const violations: Violation[] = [];

  for (const file of files) {
    const violation = checkFile(file);
    if (violation) violations.push(violation);
  }

  const checkedCount = files.length;
  const violationCount = violations.length;

  if (violationCount === 0) {
    console.log(`[check_route_contracts] All ${checkedCount} route handler(s) have response contracts.`);
    process.exit(0);
  }

  console.error(`\n[check_route_contracts] ${violationCount} violation(s) found:\n`);
  for (const v of violations) {
    const relativePath = v.file.replace(resolve(cwd) + "/", "");
    console.error(`  x ${relativePath}`);
    console.error(`    ${v.reason}\n`);
  }
  console.error(`[check_route_contracts] ${violationCount}/${checkedCount} route handler(s) missing contracts.\n`);

  if (!dryRun) process.exit(1);
}

main().catch((err: unknown) => {
  console.error("[check_route_contracts] Unexpected error:", err);
  process.exit(2);
});
