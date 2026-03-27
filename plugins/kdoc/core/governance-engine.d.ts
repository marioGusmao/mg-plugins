/**
 * kdoc Governance Engine — TypeScript type declarations.
 */

export interface Violation {
  code: string;
  severity: 'error' | 'warning';
  path: string;
  message: string;
  expected: string | null;
  actual: string | null;
  fix: string;
}

export interface GovernanceCollectorViolation {
  code: string;
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export interface AdrRecord {
  id: string;
  number: number;
  path: string;
  status: string;
  supersededBy: string | null;
  supersedes: string | null;
}

export interface CoverageByArea {
  exists: boolean;
  fileCount: number;
  missingRequired: number;
  complete?: boolean;
}

export interface CoverageByType {
  total: number;
  valid: number;
  invalid: number;
}

export interface Suggestion {
  type: string;
  path: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
}

export interface StalenessEntry {
  path: string;
  lastModified: string;
  reason: string;
}

export interface GovernanceReport {
  version: string;
  repoPath: string;
  generatedAt: string;
  healthScore: number;
  violations: Violation[];
  coverage: {
    byArea: Record<string, CoverageByArea>;
    byType: Record<string, CoverageByType>;
  };
  staleness: StalenessEntry[];
  suggestions: Suggestion[];
  degraded: boolean;
  degradedReason?: string;
}

export interface Schemas {
  structure: Record<string, unknown>;
  frontmatter: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ path?: string; message: string }>;
  parsed: Record<string, unknown> | null;
  docType?: string | null;
}

export interface WikilinkResult {
  resolved: string[];
  broken: string[];
  forbidden: string[];
}

export interface ScanArea {
  exists: boolean;
  files: string[];
  missingRequired: string[];
}

export interface ScanResult {
  areas: Record<string, ScanArea>;
  unknownFiles: string[];
}

export interface CodegraphStatus {
  available: boolean;
  dbPath?: string;
  reason?: string;
}

export interface DriftResult {
  degraded: boolean;
  reason?: string;
  results: Array<{ doc: string; status: string }>;
}

export interface ExtensionArea {
  name: string;
  directory: string;
  templates?: string[];
  required_files?: string[];
  scoped?: boolean;
  pack?: string;
}

export interface GovernanceOptions {
  schemas?: Schemas;
  codegraph?: boolean;
  emit?: boolean;
  paths?: string[];
  extensionAreas?: ExtensionArea[];
  knowledgeRoot?: string;
}

// Public API
export function loadSchemas(schemaDir?: string): Schemas;
export function clearSchemaCache(): void;
export function runGovernance(repoPath: string, options?: GovernanceOptions): GovernanceReport;
export function validateFile(filePath: string, schemas?: Schemas): ValidationResult;
export function getCoverage(repoPath: string, paths?: string[], schemas?: Schemas, options?: { extensionAreas?: ExtensionArea[]; knowledgeRoot?: string }): { byArea: Record<string, CoverageByArea> };

// Sub-module re-exports
export function validateFrontmatter(content: string, docType: string, schemas: Schemas): ValidationResult;
export function detectDocType(content: string): string | null;
export function parseFrontmatter(content: string): { parsed: Record<string, unknown> | null; errors: Array<{ line?: number; message: string }>; raw: string };
export function buildZodSchema(typeDef: Record<string, unknown>, fieldValues?: Record<string, string[]>): unknown;
export function scanRepo(repoPath: string, structureSchema: Record<string, unknown>, config?: { extensionAreas?: ExtensionArea[] }): ScanResult;
export function resolveWikilinks(filePath: string, content: string, repoPath: string): WikilinkResult;
export function buildReport(scanResult: ScanResult, validationResults: unknown[], wikilinkResults: unknown[], options?: Record<string, unknown>): GovernanceReport;
export function checkCodegraphAvailable(repoPath: string): CodegraphStatus;
export function queryDrift(repoPath: string, docFiles: string[]): DriftResult;
export function emitDaemonEvent(eventType: string, eventData: Record<string, unknown>, repoId?: string, branch?: string): void;
export function collectLegacyFrontmatterViolations(knowledgeRoot: string, repoPath: string): GovernanceCollectorViolation[];
export function collectAdrGovernanceViolations(repoPath: string, knowledgeRootName: string): GovernanceCollectorViolation[];
export function loadAdrRecords(adrDir: string): AdrRecord[];
