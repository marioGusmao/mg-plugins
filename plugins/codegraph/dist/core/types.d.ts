import type Parser from 'tree-sitter';
export interface FileRecord {
    id: number;
    path: string;
    language: string;
    hash: string;
    indexed_at: number;
}
export interface SymbolRecord {
    id: number;
    file_id: number;
    symbol_uid: string;
    name: string;
    qualified_name: string;
    container_name: string;
    kind: SymbolKind;
    line_start: number;
    line_end: number;
    exported: boolean;
}
export type SymbolKind = 'function' | 'class' | 'method' | 'variable' | 'type' | 'export' | 'doc_reference';
export interface EdgeRecord {
    id: number;
    source_uid: string;
    target_uid: string;
    kind: EdgeKind;
    confidence: EdgeConfidence;
}
export type EdgeKind = 'calls' | 'imports' | 'extends' | 'implements' | 'uses_type' | 'documents';
export type EdgeConfidence = 'syntactic' | 'semantic';
export interface FileDepRecord {
    id: number;
    source_id: number;
    target_id: number;
    kind: 'import' | 'require' | 'dynamic_import';
}
export interface ExtractedSymbol {
    name: string;
    qualified_name: string;
    container_name: string;
    kind: SymbolKind;
    line_start: number;
    line_end: number;
    exported: boolean;
}
export interface ExtractedEdge {
    sourceQualifiedName: string;
    targetName: string;
    targetImport: string | null;
    kind: EdgeKind;
    confidence: EdgeConfidence;
}
export interface ExtractedImport {
    specifiers: string[];
    source: string;
    kind: 'import' | 'require' | 'dynamic_import';
}
export interface LanguageExtractor {
    language: string;
    extensions: string[];
    extractSymbols(tree: Parser.Tree, source: string): ExtractedSymbol[];
    extractEdges(tree: Parser.Tree, source: string): ExtractedEdge[];
    extractImports(tree: Parser.Tree, source: string): ExtractedImport[];
}
export interface CallerResult {
    symbolName: string;
    filePath: string;
    lineStart: number;
    depth: number;
}
export interface DependsResult {
    filePath: string;
    kind: string;
    direction: 'in' | 'out';
}
export interface StatusResult {
    totalFiles: number;
    totalSymbols: number;
    totalEdges: number;
    staleFiles: number;
    lastIndexedAt: string | null;
    lastIndexedCommit: string | null;
    schemaVersion: string;
    languages: Record<string, number>;
}
export declare function buildSymbolUid(filePath: string, containerName: string, name: string, kind: SymbolKind, lineStart: number): string;
export declare const SCHEMA_VERSION = "1.0";
export declare const MAX_DEPTH = 15;
export declare const MAX_RESULTS = 200;
export declare const QUERY_TIMEOUT_MS = 5000;
