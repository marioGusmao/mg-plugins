import BetterSqlite3 from 'better-sqlite3';
import type { FileRecord, SymbolRecord, EdgeRecord, SymbolKind, EdgeKind, EdgeConfidence, StatusResult } from './types.js';
export interface UpsertFileInput {
    path: string;
    language: string;
    hash: string;
}
export interface InsertSymbolInput {
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
export interface InsertEdgeInput {
    source_uid: string;
    target_uid: string;
    kind: EdgeKind;
    confidence: EdgeConfidence;
}
export interface InsertFileDepInput {
    source_id: number;
    target_id: number;
    kind: 'import' | 'require' | 'dynamic_import';
}
export interface StaleFileInput {
    path: string;
    hash: string;
}
export declare class Database {
    private readonly db;
    constructor(rootDir: string);
    getMeta(key: string): string | null;
    setMeta(key: string, value: string): void;
    upsertFile(input: UpsertFileInput): number;
    getFileByPath(filePath: string): FileRecord | undefined;
    getAllFiles(): FileRecord[];
    getFileById(id: number): FileRecord | undefined;
    deleteFile(id: number): void;
    deleteFileSymbolsAndEdges(fileId: number): void;
    insertSymbol(input: InsertSymbolInput): number;
    getSymbolByUid(symbolUid: string): SymbolRecord | undefined;
    getSymbolsByFile(fileId: number): SymbolRecord[];
    getSymbolsByName(name: string): SymbolRecord[];
    searchSymbols(pattern: string, kind?: string): SymbolRecord[];
    insertEdge(input: InsertEdgeInput): number;
    getEdgesBySourceUid(sourceUid: string): EdgeRecord[];
    getEdgesByTargetUid(targetUid: string): EdgeRecord[];
    insertFileDep(input: InsertFileDepInput): number;
    getStaleFiles(currentFiles: StaleFileInput[]): FileRecord[];
    getConfigFingerprint(key: string): string | null;
    setConfigFingerprint(key: string, hash: string): void;
    prepare(sql: string): BetterSqlite3.Statement;
    transaction<T>(fn: () => T): T;
    getStatus(projectRoot?: string): StatusResult;
    close(): void;
}
