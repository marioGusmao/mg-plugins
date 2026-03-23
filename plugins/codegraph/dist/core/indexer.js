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
 * Orchestrates the hybrid indexing pipeline for a TypeScript/JavaScript
 * project rooted at `projectRoot`.
 *
 * Uses a two-pass approach inside a single transaction:
 *   Pass 1: Parse files → persist file records + symbols
 *   Pass 2: Resolve edges + file deps (all symbols now available as targets)
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
            ignore: ['**/node_modules/**', '.codegraph/**', '**/dist/**'],
            absolute: false,
            nodir: true,
        });
        // ── Step 2: Config fingerprint check ─────────────────────────────────────
        let forceFullIndex = false;
        for (const configFile of CONFIG_FILES) {
            const configPath = path.join(this.projectRoot, configFile);
            const currentHash = this.hashFile(configPath);
            const storedHash = this.db.getConfigFingerprint(configFile);
            const normalizedCurrent = currentHash ?? '__absent__';
            const normalizedStored = storedHash ?? '__absent__';
            if (normalizedCurrent !== normalizedStored) {
                forceFullIndex = true;
            }
            // Always update fingerprint regardless of match
            this.db.setConfigFingerprint(configFile, normalizedCurrent);
        }
        // ── Step 3: Diff (hash comparison + git diff) ────────────────────────────
        const fileHashes = new Map();
        for (const relPath of discoveredFiles) {
            const absPath = path.join(this.projectRoot, relPath);
            const hash = this.hashFile(absPath);
            if (hash !== null) {
                fileHashes.set(relPath, hash);
            }
        }
        let filesToProcess;
        if (!incremental || forceFullIndex) {
            filesToProcess = discoveredFiles.filter((f) => fileHashes.has(f));
        }
        else {
            const changedByHash = this.diffByHash(fileHashes);
            const changedByGit = this.diffByGit();
            const changedSet = new Set([...changedByHash, ...changedByGit]);
            filesToProcess = discoveredFiles.filter((f) => fileHashes.has(f) && changedSet.has(f));
        }
        // ── Prepare TSService for semantic analysis ─────────────────────────────
        let tsService = null;
        try {
            tsService = new TSService(this.projectRoot);
        }
        catch {
            tsService = null;
        }
        const stats = {
            filesProcessed: 0,
            symbolsFound: 0,
            syntacticEdges: 0,
            semanticEdges: 0,
            docsProcessed: 0,
            referencesFound: 0,
        };
        const resolver = new Resolver(this.projectRoot);
        // ── Discover doc files for cleanup and incremental ──────────────────────
        const discoveredDocFiles = globSync('**/*.{md,mdx}', {
            cwd: this.projectRoot,
            ignore: ['**/node_modules/**', '.codegraph/**', '**/dist/**'],
            absolute: false,
            nodir: true,
        });
        // Collect inbound edges from other files BEFORE deleting symbols.
        // These would be lost due to FK CASCADE when symbols are deleted.
        // Track old→new UID mapping so edges survive line-number shifts
        // (buildSymbolUid includes lineStart, so shifting code changes UIDs).
        const savedInboundEdges = [];
        const oldUidToNewUid = new Map();
        // Map symbol identity (name:kind:container) → old UID, per file
        const symbolKeyToOldUid = new Map();
        this.db.transaction(() => {
            // ====================================================================
            // PASS 1: Parse all files → persist file records + symbols
            // ====================================================================
            const parseResults = [];
            for (const relPath of filesToProcess) {
                const absPath = path.join(this.projectRoot, relPath);
                const ext = path.extname(relPath).toLowerCase();
                const extractor = this.extractors.get(ext);
                if (!extractor)
                    continue;
                const source = this.readFile(absPath);
                if (source === null)
                    continue;
                const grammar = this.grammarForExtension(ext);
                if (!grammar)
                    continue;
                try {
                    this.parser.setLanguage(grammar);
                }
                catch {
                    continue;
                }
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
                const hash = fileHashes.get(relPath) ?? '';
                const language = extractor.language;
                // Save inbound edges and old symbol UIDs before cascade-deleting
                const existingFile = this.db.getFileByPath(relPath);
                if (existingFile) {
                    savedInboundEdges.push(...this.db.getInboundEdgesFromOtherFiles(existingFile.id));
                    // Save old UIDs keyed by symbol identity for remapping after reinsert
                    const oldSymbols = this.db.getSymbolsByFile(existingFile.id);
                    for (const s of oldSymbols) {
                        symbolKeyToOldUid.set(`${relPath}:${s.name}:${s.kind}:${s.container_name}`, s.symbol_uid);
                    }
                    this.db.deleteFileSymbolsAndEdges(existingFile.id);
                }
                const fileId = this.db.upsertFile({ path: relPath, language, hash });
                // Persist symbols
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
                    // Build old→new UID mapping for inbound edge restoration
                    const symKey = `${relPath}:${sym.name}:${sym.kind}:${sym.container_name}`;
                    const oldUid = symbolKeyToOldUid.get(symKey);
                    if (oldUid && oldUid !== uid) {
                        oldUidToNewUid.set(oldUid, uid);
                    }
                    stats.symbolsFound++;
                }
                parseResults.push({
                    relPath,
                    absPath,
                    fileId,
                    extractedSymbols,
                    extractedEdges,
                    extractedImports,
                    symbolUidMap,
                });
                stats.filesProcessed++;
            }
            // Restore inbound edges from other files that were cascade-deleted.
            // Remap target UIDs in case line numbers shifted (UID includes lineStart).
            for (const edge of savedInboundEdges) {
                const remappedTarget = oldUidToNewUid.get(edge.target_uid) ?? edge.target_uid;
                try {
                    this.db.insertEdge({
                        source_uid: edge.source_uid,
                        target_uid: remappedTarget,
                        kind: edge.kind,
                        confidence: edge.confidence,
                    });
                }
                catch {
                    // Source or target symbol may no longer exist (renamed/removed) — skip
                }
            }
            // ====================================================================
            // PASS 2: Resolve edges + file deps (all symbols now in DB)
            // ====================================================================
            for (const pr of parseResults) {
                // Syntactic edges
                for (const edge of pr.extractedEdges) {
                    const sourceUid = pr.symbolUidMap.get(edge.sourceQualifiedName);
                    if (!sourceUid)
                        continue;
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
                    }
                }
                // Semantic edges
                if (tsService !== null) {
                    this.insertSemanticEdges(tsService, pr.absPath, pr.extractedSymbols, pr.symbolUidMap);
                }
                // File deps
                for (const imp of pr.extractedImports) {
                    const resolvedRelPath = resolver.resolveImportPath(imp.source, pr.absPath);
                    if (!resolvedRelPath)
                        continue;
                    const targetFile = this.db.getFileByPath(resolvedRelPath);
                    if (!targetFile)
                        continue;
                    this.db.insertFileDep({
                        source_id: pr.fileId,
                        target_id: targetFile.id,
                        kind: imp.kind,
                    });
                }
            }
            // ====================================================================
            // PASS 3: Index documentation (inside same transaction)
            // ====================================================================
            // If any symbol UIDs changed (line shifts), force full doc reindex
            // so doc_reference edges point to the correct new UIDs.
            const symbolsShifted = oldUidToNewUid.size > 0;
            const docStats = this.indexDocumentationInTransaction(discoveredDocFiles, incremental && !forceFullIndex && !symbolsShifted);
            stats.docsProcessed = docStats.docsProcessed;
            stats.referencesFound = docStats.referencesFound;
            // ── Cleanup deleted files (code + docs) ────────────────────────────────
            this.cleanupDeletedFiles(discoveredFiles, discoveredDocFiles);
        });
        // Dispose TSService
        if (tsService !== null) {
            tsService.dispose();
        }
        // Derive accurate edge counts from DB state
        const syntacticCount = this.db.prepare("SELECT COUNT(*) as cnt FROM edges WHERE confidence = 'syntactic'").get().cnt;
        const semanticCount = this.db.prepare("SELECT COUNT(*) as cnt FROM edges WHERE confidence = 'semantic'").get().cnt;
        stats.syntacticEdges = syntacticCount;
        stats.semanticEdges = semanticCount;
        // Store git metadata
        this.persistGitMeta();
        return stats;
    }
    close() {
        this.db.close();
    }
    // ---------------------------------------------------------------------------
    // Documentation indexing (runs inside the main transaction)
    // ---------------------------------------------------------------------------
    /**
     * Index Markdown/MDX files inside the caller's transaction.
     * In incremental mode, only re-processes changed doc files.
     */
    indexDocumentationInTransaction(docFiles, incremental) {
        const knownSymbolNames = new Set(this.db.prepare('SELECT DISTINCT name FROM symbols WHERE kind != \'doc_reference\'').all()
            .map(r => r.name));
        let docsProcessed = 0;
        let referencesFound = 0;
        let docsToProcess;
        if (incremental) {
            // Only process changed/new doc files
            docsToProcess = [];
            for (const relPath of docFiles) {
                const absPath = path.join(this.projectRoot, relPath);
                const hash = this.hashFile(absPath);
                if (hash === null)
                    continue;
                const record = this.db.getFileByPath(relPath);
                if (!record || record.hash !== hash) {
                    docsToProcess.push(relPath);
                }
            }
        }
        else {
            docsToProcess = docFiles;
        }
        for (const relPath of docsToProcess) {
            const absPath = path.join(this.projectRoot, relPath);
            const source = this.readFile(absPath);
            if (source === null)
                continue;
            const hash = this.hashFile(absPath);
            if (hash === null)
                continue;
            const existingFile = this.db.getFileByPath(relPath);
            if (existingFile) {
                this.db.deleteFileSymbolsAndEdges(existingFile.id);
            }
            const fileId = this.db.upsertFile({ path: relPath, language: 'markdown', hash });
            const docRefs = extractDocReferences(source, knownSymbolNames);
            for (const ref of docRefs) {
                const codeSymbols = this.db.getSymbolsByName(ref.symbolName);
                if (codeSymbols.length === 0)
                    continue;
                const docSymUid = buildSymbolUid(relPath, ref.context, ref.symbolName, 'doc_reference', ref.line);
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
                for (const codeSym of codeSymbols) {
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
        return { docsProcessed, referencesFound };
    }
    /**
     * Legacy public API — kept for backwards compatibility with tests/callers
     * that call indexDocumentation() directly. Wraps in its own transaction.
     */
    indexDocumentation() {
        const docFiles = globSync('**/*.{md,mdx}', {
            cwd: this.projectRoot,
            ignore: ['**/node_modules/**', '.codegraph/**', '**/dist/**'],
            absolute: false,
            nodir: true,
        });
        let result = { docsProcessed: 0, referencesFound: 0 };
        this.db.transaction(() => {
            result = this.indexDocumentationInTransaction(docFiles, false);
        });
        return result;
    }
    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------
    /**
     * Insert semantic edges for a single file using the TS LanguageService.
     * All symbols are already in the DB (pass 2), so file-scoped filtering works.
     */
    insertSemanticEdges(tsService, absPath, extractedSymbols, symbolUidMap) {
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
                const targetSymbols = this.db.getSymbolsByName(call.calleeName);
                for (const targetSym of targetSymbols) {
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
                    }
                    catch {
                        // Edge may already exist or violate a constraint — skip
                    }
                }
            }
        }
    }
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
    diffByGit() {
        const lastCommit = this.db.getMeta('last_indexed_commit');
        if (!lastCommit)
            return [];
        try {
            const output = execFileSync('git', ['diff', '--name-only', lastCommit], { cwd: this.projectRoot, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
            return output
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean);
        }
        catch {
            return [];
        }
    }
    persistGitMeta() {
        try {
            const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: this.projectRoot, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
            this.db.setMeta('last_indexed_commit', commit);
        }
        catch {
            // Not a git repo or git not available — skip
        }
        this.db.setMeta('last_indexed_at', new Date().toISOString());
    }
    /**
     * Remove DB records for files no longer present on disk.
     * Accepts both code files and doc files for complete cleanup.
     */
    cleanupDeletedFiles(currentCodeFiles, currentDocFiles) {
        const currentSet = new Set([...currentCodeFiles, ...currentDocFiles]);
        const allDbFiles = this.db.getAllFiles();
        for (const dbFile of allDbFiles) {
            if (!currentSet.has(dbFile.path)) {
                this.db.deleteFile(dbFile.id);
            }
        }
    }
    collectExtensions() {
        const extSet = new Set();
        for (const extractor of this.extractors.values()) {
            for (const ext of extractor.extensions) {
                extSet.add(ext);
            }
        }
        return Array.from(extSet).sort();
    }
    grammarForExtension(ext) {
        switch (ext) {
            case '.ts':
                return tsGrammar.typescript;
            case '.tsx':
                return tsGrammar.tsx;
            case '.js':
            case '.jsx':
                return jsGrammar;
            default:
                return null;
        }
    }
    readFile(absPath) {
        try {
            return fs.readFileSync(absPath, 'utf8');
        }
        catch {
            return null;
        }
    }
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