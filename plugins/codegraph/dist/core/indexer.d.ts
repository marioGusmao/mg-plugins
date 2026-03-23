export interface IndexOptions {
    incremental?: boolean;
}
export interface IndexStats {
    filesProcessed: number;
    symbolsFound: number;
    syntacticEdges: number;
    semanticEdges: number;
    docsProcessed: number;
    referencesFound: number;
}
/**
 * Orchestrates the hybrid indexing pipeline for a TypeScript/JavaScript
 * project rooted at `projectRoot`.
 *
 * Uses a two-pass approach inside a single transaction:
 *   Pass 1: Parse files → persist file records + symbols
 *   Pass 2: Resolve edges + file deps (all symbols now available as targets)
 */
export declare class Indexer {
    private readonly projectRoot;
    private readonly db;
    private readonly parser;
    private readonly extractors;
    constructor(projectRoot: string);
    /**
     * Run the indexing pipeline.
     *
     * In incremental mode the pipeline skips files whose content hash has not
     * changed since the last run (unless a config file changed, which triggers a
     * full re-index).
     */
    index(options?: IndexOptions): IndexStats;
    close(): void;
    /**
     * Index Markdown/MDX files inside the caller's transaction.
     * In incremental mode, only re-processes changed doc files.
     */
    private indexDocumentationInTransaction;
    /**
     * Legacy public API — kept for backwards compatibility with tests/callers
     * that call indexDocumentation() directly. Wraps in its own transaction.
     */
    indexDocumentation(): {
        docsProcessed: number;
        referencesFound: number;
    };
    /**
     * Insert semantic edges for a single file using the TS LanguageService.
     * All symbols are already in the DB (pass 2), so file-scoped filtering works.
     */
    private insertSemanticEdges;
    private diffByHash;
    private diffByGit;
    private persistGitMeta;
    /**
     * Remove DB records for files no longer present on disk.
     * Accepts both code files and doc files for complete cleanup.
     */
    private cleanupDeletedFiles;
    private collectExtensions;
    private grammarForExtension;
    private readFile;
    private hashFile;
}
