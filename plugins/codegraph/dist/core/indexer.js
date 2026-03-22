import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';
import Parser from 'tree-sitter';
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
import tsGrammar from 'tree-sitter-typescript';
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
import jsGrammar from 'tree-sitter-javascript';
import { Database } from './db.js';
import { Resolver } from './resolver.js';
import { TSService } from '../semantic/ts-service.js';
import { TypeScriptExtractor } from '../extractors/typescript.js';
import { extractDocReferences } from '../extractors/markdown.js';
import { buildSymbolUid } from './types.js';
// ---------------------------------------------------------------------------
// Config files whose hash is tracked for cache-busting
// ---------------------------------------------------------------------------
const CONFIG_FILES = ['tsconfig.json', 'package.json', 'pnpm-workspace.yaml'];
// ---------------------------------------------------------------------------
// Indexer
// ---------------------------------------------------------------------------
/**
 * Orchestrates the 9-step hybrid indexing pipeline for a TypeScript/JavaScript
 * project rooted at `projectRoot`.
 *
 * The pipeline is fully synchronous: better-sqlite3, tree-sitter, and all
 * file-system operations are sync, so no async ceremony is needed.
 */
export class Indexer {
    projectRoot;
    db;
    parser;
    extractors;
    constructor(projectRoot) {
        this.projectRoot = path.resolve(projectRoot);
        this.db = new Database(this.projectRoot);
        // Build parser
        this.parser = new Parser();
        // Register extractors
        this.extractors = new Map();
        const tsExtractor = new TypeScriptExtractor();
        for (const ext of tsExtractor.extensions) {
            this.extractors.set(ext, tsExtractor);
        }
    }
    /**
     * Run the indexing pipeline.
     *
     * In incremental mode the pipeline skips files whose content hash has not
     * changed since the last run (unless a config file changed, which triggers a
     * full re-index).
     */
    index(options = {}) {
        const { incremental = false } = options;
        // ── Step 1: Discover source files ───────────────────────────────────────
        const extensions = this.collectExtensions();
        const pattern = `**/*.{${extensions.map((e) => e.slice(1)).join(',')}}`;
        const discoveredFiles = globSync(pattern, {
            cwd: this.projectRoot,
            ignore: ['node_modules/**', '.codegraph/**', 'dist/**'],
            absolute: false,
            nodir: true,
        });
        // ── Step 2: Config fingerprint check ─────────────────────────────────────
        let forceFullIndex = false;
        for (const configFile of CONFIG_FILES) {
            const configPath = path.join(this.projectRoot, configFile);
            const currentHash = this.hashFile(configPath);
            const storedHash = this.db.getConfigFingerprint(configFile);
            if (currentHash !== storedHash) {
                forceFullIndex = true;
            }
            // Always update fingerprint regardless of match
            this.db.setConfigFingerprint(configFile, currentHash ?? '');
        }
        // ── Step 3: Diff (hash comparison + git diff) ────────────────────────────
        // Compute SHA-256 hash for each discovered file
        const fileHashes = new Map();
        for (const relPath of discoveredFiles) {
            const absPath = path.join(this.projectRoot, relPath);
            const hash = this.hashFile(absPath);
            if (hash !== null) {
                fileHashes.set(relPath, hash);
            }
        }
        // Determine which files to process
        let filesToProcess;
        if (!incremental || forceFullIndex) {
            filesToProcess = discoveredFiles.filter((f) => fileHashes.has(f));
        }
        else {
            // Incremental: only changed or new files
            const changedByHash = this.diffByHash(fileHashes);
            const changedByGit = this.diffByGit();
            const changedSet = new Set([...changedByHash, ...changedByGit]);
            filesToProcess = discoveredFiles.filter((f) => fileHashes.has(f) && changedSet.has(f));
        }
        // ── Prepare TSService for Step 5 (semantic analysis) ─────────────────────
        let tsService = null;
        try {
            tsService = new TSService(this.projectRoot);
        }
        catch {
            // tsconfig may be invalid or absent — fall back to syntactic-only
            tsService = null;
        }
        // ── Steps 4-7: Per-file loop (parse → persist → semantic → resolve) ──────
        const stats = {
            filesProcessed: 0,
            symbolsFound: 0,
            syntacticEdges: 0,
            semanticEdges: 0,
            docsProcessed: 0,
            referencesFound: 0,
        };
        const resolver = new Resolver(this.projectRoot);
        this.db.transaction(() => {
            for (const relPath of filesToProcess) {
                const absPath = path.join(this.projectRoot, relPath);
                const ext = path.extname(relPath).toLowerCase();
                const extractor = this.extractors.get(ext);
                if (!extractor)
                    continue;
                const source = this.readFile(absPath);
                if (source === null)
                    continue;
                // Set grammar based on extension
                const grammar = this.grammarForExtension(ext);
                if (!grammar)
                    continue;
                try {
                    this.parser.setLanguage(grammar);
                }
                catch {
                    continue;
                }
                // ── Step 4: Parse with Tree-sitter (structural / syntactic) ──────────
                let tree;
                try {
                    tree = this.parser.parse(source);
                }
                catch {
                    continue;
                }
                const extractedSymbols = extractor.extractSymbols(tree, source);
                const extractedEdges = extractor.extractEdges(tree, source);
                const extractedImports = extractor.extractImports(tree, source);
                // ── Step 4b: Persist file record ──────────────────────────────────────
                const hash = fileHashes.get(relPath) ?? '';
                const language = extractor.language;
                // Clear old symbols/edges for this file before reinserting
                const existingFile = this.db.getFileByPath(relPath);
                if (existingFile) {
                    this.db.deleteFileSymbolsAndEdges(existingFile.id);
                }
                const fileId = this.db.upsertFile({ path: relPath, language, hash });
                // ── Step 4c: Persist symbols ──────────────────────────────────────────
                const symbolUidMap = new Map();
                for (const sym of extractedSymbols) {
                    const uid = buildSymbolUid(relPath, sym.container_name, sym.name, sym.kind, sym.line_start);
                    this.db.insertSymbol({
                        file_id: fileId,
                        symbol_uid: uid,
                        name: sym.name,
                        qualified_name: sym.qualified_name,
                        container_name: sym.container_name,
                        kind: sym.kind,
                        line_start: sym.line_start,
                        line_end: sym.line_end,
                        exported: sym.exported,
                    });
                    symbolUidMap.set(sym.qualified_name, uid);
                    stats.symbolsFound++;
                }
                // ── Step 4d: Persist syntactic edges ──────────────────────────────────
                for (const edge of extractedEdges) {
                    const sourceUid = symbolUidMap.get(edge.sourceQualifiedName);
                    if (!sourceUid)
                        continue;
                    // Find a matching target symbol by name in the DB
                    const targetSymbols = this.db.getSymbolsByName(edge.targetName);
                    if (targetSymbols.length === 0)
                        continue;
                    for (const targetSym of targetSymbols) {
                        this.db.insertEdge({
                            source_uid: sourceUid,
                            target_uid: targetSym.symbol_uid,
                            kind: edge.kind,
                            confidence: 'syntactic',
                        });
                        stats.syntacticEdges++;
                    }
                }
                // ── Step 5: Semantic edges via TS LanguageService ──────────────────────
                if (tsService !== null) {
                    this.insertSemanticEdges(tsService, absPath, relPath, extractedSymbols, symbolUidMap, stats);
                }
                // ── Step 6: Resolve cross-file imports → file_deps ────────────────────
                for (const imp of extractedImports) {
                    const resolvedRelPath = resolver.resolveImportPath(imp.source, absPath);
                    if (!resolvedRelPath)
                        continue;
                    const targetFile = this.db.getFileByPath(resolvedRelPath);
                    if (!targetFile)
                        continue;
                    this.db.insertFileDep({
                        source_id: fileId,
                        target_id: targetFile.id,
                        kind: imp.kind,
                    });
                }
                stats.filesProcessed++;
            }
            // ── Step 7: Cleanup deleted files (inside transaction for atomicity) ──
            this.cleanupDeletedFiles(discoveredFiles);
        });
        // Dispose TSService
        if (tsService !== null) {
            tsService.dispose();
        }
        // ── Step 8: Store git metadata ────────────────────────────────────────────
        this.persistGitMeta();
        // ── Step 9: Index documentation (.md/.mdx) ──────────────────────────────
        const docStats = this.indexDocumentation();
        stats.docsProcessed = docStats.docsProcessed;
        stats.referencesFound = docStats.referencesFound;
        return stats;
    }
    /**
     * Step 9: Discover and index Markdown/MDX files.
     *
     * For each doc file:
     * 1. Compute hash and upsert the file record (language: 'markdown')
     * 2. Extract references to known code symbols
     * 3. For each reference, create a doc_reference symbol and a `documents` edge
     *    pointing from the doc_reference → the code symbol(s) with that name
     */
    indexDocumentation() {
        const docFiles = globSync('**/*.{md,mdx}', {
            cwd: this.projectRoot,
            ignore: ['node_modules/**', '.codegraph/**', 'dist/**'],
            absolute: false,
            nodir: true,
        });
        // Build a set of all known symbol names from the DB
        const knownSymbolNames = new Set(this.db.prepare('SELECT DISTINCT name FROM symbols').all()
            .map(r => r.name));
        let docsProcessed = 0;
        let referencesFound = 0;
        this.db.transaction(() => {
            for (const relPath of docFiles) {
                const absPath = path.join(this.projectRoot, relPath);
                const source = this.readFile(absPath);
                if (source === null)
                    continue;
                const hash = this.hashFile(absPath);
                if (hash === null)
                    continue;
                // Clear old symbols for this doc file before reinserting
                const existingFile = this.db.getFileByPath(relPath);
                if (existingFile) {
                    this.db.deleteFileSymbolsAndEdges(existingFile.id);
                }
                const fileId = this.db.upsertFile({ path: relPath, language: 'markdown', hash });
                const docRefs = extractDocReferences(source, knownSymbolNames);
                for (const ref of docRefs) {
                    // Find all code symbols matching this name
                    const codeSymbols = this.db.getSymbolsByName(ref.symbolName);
                    if (codeSymbols.length === 0)
                        continue;
                    // Create a doc_reference symbol for this doc location.
                    // The context line is stored in container_name for retrieval by QueryEngine.
                    const docSymUid = buildSymbolUid(relPath, ref.context, // stored in container_name
                    ref.symbolName, 'doc_reference', ref.line);
                    this.db.insertSymbol({
                        file_id: fileId,
                        symbol_uid: docSymUid,
                        name: ref.symbolName,
                        qualified_name: `${relPath}:${ref.line}:${ref.symbolName}`,
                        container_name: ref.context,
                        kind: 'doc_reference',
                        line_start: ref.line,
                        line_end: ref.line,
                        exported: false,
                    });
                    // Link to all matching code symbols
                    for (const codeSym of codeSymbols) {
                        // Skip other doc_reference symbols to avoid doc→doc edges
                        if (codeSym.kind === 'doc_reference')
                            continue;
                        this.db.insertEdge({
                            source_uid: docSymUid,
                            target_uid: codeSym.symbol_uid,
                            kind: 'documents',
                            confidence: 'syntactic',
                        });
                        referencesFound++;
                    }
                }
                docsProcessed++;
            }
        });
        return { docsProcessed, referencesFound };
    }
    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------
    /**
     * Insert semantic edges for a single file using the TS LanguageService.
     * Semantic edges (confidence: 'semantic') overwrite syntactic ones for
     * the same source_uid/target_uid pair — the DB layer handles this via
     * DELETE before INSERT in `insertEdge`.
     */
    insertSemanticEdges(tsService, absPath, relPath, extractedSymbols, symbolUidMap, stats) {
        for (const sym of extractedSymbols) {
            if (sym.kind !== 'function' && sym.kind !== 'method')
                continue;
            const sourceUid = symbolUidMap.get(sym.qualified_name);
            if (!sourceUid)
                continue;
            let outgoingCalls;
            try {
                outgoingCalls = tsService.getOutgoingCalls(absPath, sym.name);
            }
            catch {
                continue;
            }
            for (const call of outgoingCalls) {
                const calleeRelPath = path.relative(this.projectRoot, call.calleeFile);
                // Find matching target symbol by name across all files
                const targetSymbols = this.db.getSymbolsByName(call.calleeName);
                for (const targetSym of targetSymbols) {
                    // Prefer symbols from the callee file when path is known
                    const targetFile = this.db.getFileByPath(calleeRelPath);
                    if (targetFile && targetSym.file_id !== targetFile.id)
                        continue;
                    try {
                        this.db.insertEdge({
                            source_uid: sourceUid,
                            target_uid: targetSym.symbol_uid,
                            kind: 'calls',
                            confidence: 'semantic',
                        });
                        stats.semanticEdges++;
                    }
                    catch {
                        // Edge may already exist or violate a constraint — skip
                    }
                }
            }
        }
    }
    /**
     * Compare current file hashes against DB records.
     * Returns relative paths of files that have changed or are new.
     */
    diffByHash(fileHashes) {
        const changed = [];
        for (const [relPath, hash] of fileHashes) {
            const record = this.db.getFileByPath(relPath);
            if (!record || record.hash !== hash) {
                changed.push(relPath);
            }
        }
        return changed;
    }
    /**
     * Use `git diff --name-only <last_indexed_commit>` to find files that have
     * changed since the last index. Falls back to empty array when no git repo
     * or no prior commit is stored.
     */
    diffByGit() {
        const lastCommit = this.db.getMeta('last_indexed_commit');
        if (!lastCommit)
            return [];
        try {
            const output = execFileSync('git', ['diff', '--name-only', lastCommit], { cwd: this.projectRoot, encoding: 'utf8', timeout: 5000 });
            return output
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean);
        }
        catch {
            return [];
        }
    }
    /**
     * Store `git rev-parse HEAD` and the current ISO timestamp in DB meta.
     * Silently skips when the project is not a git repository.
     */
    persistGitMeta() {
        try {
            const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: this.projectRoot, encoding: 'utf8', timeout: 5000 }).trim();
            this.db.setMeta('last_indexed_commit', commit);
        }
        catch {
            // Not a git repo or git not available — skip
        }
        this.db.setMeta('last_indexed_at', new Date().toISOString());
    }
    /**
     * Remove DB records for files that are no longer present on disk.
     * The CASCADE constraint on symbols/edges handles dependent rows.
     */
    cleanupDeletedFiles(currentFiles) {
        const currentSet = new Set(currentFiles);
        const allDbFiles = this.db.getAllFiles();
        for (const dbFile of allDbFiles) {
            if (!currentSet.has(dbFile.path)) {
                this.db.deleteFile(dbFile.id);
            }
        }
    }
    /** Returns a sorted, deduplicated list of file extensions from all registered extractors. */
    collectExtensions() {
        const extSet = new Set();
        for (const extractor of this.extractors.values()) {
            for (const ext of extractor.extensions) {
                extSet.add(ext);
            }
        }
        return Array.from(extSet).sort();
    }
    /**
     * Returns the tree-sitter grammar object for a given file extension.
     * Returns null for unrecognized extensions.
     */
    grammarForExtension(ext) {
        switch (ext) {
            case '.ts':
                return tsGrammar.typescript;
            case '.tsx':
                return tsGrammar.tsx;
            case '.js':
            case '.jsx':
                // tree-sitter-javascript handles both JS and JSX
                return jsGrammar;
            default:
                return null;
        }
    }
    /** Read a file synchronously, returning null on error. */
    readFile(absPath) {
        try {
            return fs.readFileSync(absPath, 'utf8');
        }
        catch {
            return null;
        }
    }
    /**
     * Compute SHA-256 hash of a file on disk.
     * Returns null when the file does not exist or cannot be read.
     */
    hashFile(absPath) {
        try {
            const content = fs.readFileSync(absPath);
            return createHash('sha256').update(content).digest('hex');
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=indexer.js.map