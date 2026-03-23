import type { Database } from './db.js';
import type { CallerResult, DependsResult } from './types.js';
export interface BriefResult {
    overview: {
        totalFiles: number;
        totalSymbols: number;
        totalEdges: number;
        languages: Record<string, number>;
        lastIndexedAt: string | null;
        lastIndexedCommit: string | null;
    };
    modules: Array<{
        path: string;
        fileCount: number;
        symbolCount: number;
        dependsOn: string[];
    }>;
    hotspots: Array<{
        symbolName: string;
        qualifiedName: string;
        filePath: string;
        lineStart: number;
        callerCount: number;
    }>;
    entryPoints: Array<{
        symbolName: string;
        filePath: string;
        lineStart: number;
        category: string;
    }>;
    riskZones: Array<{
        filePath: string;
        dependentCount: number;
        risk: 'HIGH' | 'MEDIUM' | 'LOW';
    }>;
    coupledPairs: Array<{
        fileA: string;
        fileB: string;
    }>;
}
export interface DisambiguationResult {
    disambiguation: true;
    matches: DisambiguationMatch[];
}
export interface DisambiguationMatch {
    name: string;
    kind: string;
    file_path: string;
    line_start: number;
}
export interface DocRefResult {
    docFile: string;
    line: number;
    context: string;
}
export interface BlastResult {
    callers: CallerResult[];
    callees: CallerResult[];
    affectedFiles: string[];
    docReferences: DocRefResult[];
}
export interface SearchResult {
    symbolName: string;
    qualifiedName: string;
    kind: string;
    filePath: string;
    lineStart: number;
}
/** Type guard: checks whether a value is a DisambiguationResult. */
export declare function isDisambiguation(value: unknown): value is DisambiguationResult;
export declare class QueryEngine {
    private readonly db;
    constructor(db: Database);
    /**
     * Find all callers of a symbol by name.
     * Returns a DisambiguationResult when the name is ambiguous and no file is provided.
     */
    callers(name: string, file?: string, depth?: number): CallerResult[] | DisambiguationResult;
    /**
     * Find callers by exact symbol_uid — always unambiguous.
     */
    callersByUid(uid: string, depth?: number): CallerResult[];
    /**
     * Find callees by exact symbol_uid — always unambiguous.
     */
    calleesByUid(uid: string, depth?: number): CallerResult[];
    /**
     * Find callers by qualified_name scoped to a file — resolves method overloads.
     */
    callersByQualifiedName(qualifiedName: string, file: string, depth?: number): CallerResult[] | DisambiguationResult;
    /**
     * Find callees by qualified_name scoped to a file — resolves method overloads.
     */
    calleesByQualifiedName(qualifiedName: string, file: string, depth?: number): CallerResult[] | DisambiguationResult;
    /**
     * Find all callees of a symbol by name.
     * Returns a DisambiguationResult when the name is ambiguous and no file is provided.
     */
    callees(name: string, file?: string, depth?: number): CallerResult[] | DisambiguationResult;
    /**
     * Union of callers + callees + affected files + doc references for a symbol.
     */
    blast(name: string, file?: string, depth?: number): BlastResult | DisambiguationResult;
    /**
     * Blast radius by exact symbol_uid — always unambiguous.
     */
    blastByUid(uid: string, depth?: number): BlastResult;
    private blastFromUid;
    /**
     * Find all documentation references pointing to a code symbol.
     * Queries `documents` edges where the target symbol matches `symbolName`.
     * Optionally filters to a specific file.
     */
    getDocReferences(symbolName: string, file?: string): DocRefResult[];
    /**
     * File dependency tree for a given file.
     * direction: 'in' | 'out' | 'both'
     */
    depends(file: string, direction: 'in' | 'out' | 'both'): DependsResult[];
    /**
     * Symbol search by name/qualified_name substring.
     */
    search(query: string, kind?: string): SearchResult[];
    /**
     * Build a complete codebase briefing: overview, module map, hotspots,
     * entry points, risk zones, and tightly-coupled file pairs.
     */
    brief(): BriefResult;
    /**
     * Resolve a symbol name (+ optional file filter) to a single symbol_uid.
     * Returns null when no match is found, and DisambiguationResult when multiple
     * symbols match and cannot be narrowed to one.
     */
    private resolveSymbol;
    /**
     * Resolve a qualified_name scoped to a file to a single symbol_uid.
     * Returns null when not found, DisambiguationResult when still ambiguous.
     */
    private resolveByQualifiedName;
    private callersFromUid;
    private calleesFromUid;
    /**
     * Execute the recursive CTE for callers or callees.
     * 'callers': traverse edges in reverse (find who points TO uid)
     * 'callees': traverse edges forward (find what uid points TO)
     */
    private execRecursiveCte;
    private queryFileDepsInbound;
    private queryFileDepsOutbound;
    private getFileById;
    private getSymbolFile;
    /**
     * Execute a raw SQL query against the underlying better-sqlite3 instance.
     * Uses the public prepare() method exposed by Database.
     */
    private rawQuery;
}
