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
 * Orchestrates the 9-step hybrid indexing pipeline for a TypeScript/JavaScript
 * project rooted at `projectRoot`.
 *
 * The pipeline is fully synchronous: better-sqlite3, tree-sitter, and all
 * file-system operations are sync, so no async ceremony is needed.
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
    /**
     * Step 9: Discover and index Markdown/MDX files.
     *
     * For each doc file:
     * 1. Compute hash and upsert the file record (language: 'markdown')
     * 2. Extract references to known code symbols
     * 3. For each reference, create a doc_reference symbol and a `documents` edge
     *    pointing from the doc_reference → the code symbol(s) with that name
     */
    indexDocumentation(): {
        docsProcessed: number;
        referencesFound: number;
    };
    /**
     * Insert semantic edges for a single file using the TS LanguageService.
     * Semantic edges (confidence: 'semantic') overwrite syntactic ones for
     * the same source_uid/target_uid pair — the DB layer handles this via
     * DELETE before INSERT in `insertEdge`.
     */
    private insertSemanticEdges;
    /**
     * Compare current file hashes against DB records.
     * Returns relative paths of files that have changed or are new.
     */
    private diffByHash;
    /**
     * Use `git diff --name-only <last_indexed_commit>` to find files that have
     * changed since the last index. Falls back to empty array when no git repo
     * or no prior commit is stored.
     */
    private diffByGit;
    /**
     * Store `git rev-parse HEAD` and the current ISO timestamp in DB meta.
     * Silently skips when the project is not a git repository.
     */
    private persistGitMeta;
    /**
     * Remove DB records for files that are no longer present on disk.
     * The CASCADE constraint on symbols/edges handles dependent rows.
     */
    private cleanupDeletedFiles;
    /** Returns a sorted, deduplicated list of file extensions from all registered extractors. */
    private collectExtensions;
    /**
     * Returns the tree-sitter grammar object for a given file extension.
     * Returns null for unrecognized extensions.
     */
    private grammarForExtension;
    /** Read a file synchronously, returning null on error. */
    private readFile;
    /**
     * Compute SHA-256 hash of a file on disk.
     * Returns null when the file does not exist or cannot be read.
     */
    private hashFile;
}
