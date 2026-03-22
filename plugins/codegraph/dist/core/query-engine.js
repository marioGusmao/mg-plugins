import { MAX_DEPTH, MAX_RESULTS } from './types.js';
/** Type guard: checks whether a value is a DisambiguationResult. */
export function isDisambiguation(value) {
    return value !== null && typeof value === 'object' && value.disambiguation === true;
}
export class QueryEngine {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Find all callers of a symbol by name.
     * Returns a DisambiguationResult when the name is ambiguous and no file is provided.
     */
    callers(name, file, depth) {
        const resolved = this.resolveSymbol(name, file);
        if (isDisambiguation(resolved))
            return resolved;
        if (resolved === null)
            return [];
        return this.callersFromUid(resolved, depth);
    }
    /**
     * Find callers by exact symbol_uid — always unambiguous.
     */
    callersByUid(uid, depth) {
        return this.callersFromUid(uid, depth);
    }
    /**
     * Find callees by exact symbol_uid — always unambiguous.
     */
    calleesByUid(uid, depth) {
        const symbol = this.db.getSymbolByUid(uid);
        if (!symbol)
            return [];
        return this.calleesFromUid(uid, depth);
    }
    /**
     * Find callers by qualified_name scoped to a file — resolves method overloads.
     */
    callersByQualifiedName(qualifiedName, file, depth) {
        const uid = this.resolveByQualifiedName(qualifiedName, file);
        if (uid === null)
            return [];
        if (isDisambiguation(uid))
            return uid;
        return this.callersFromUid(uid, depth);
    }
    /**
     * Find all callees of a symbol by name.
     * Returns a DisambiguationResult when the name is ambiguous and no file is provided.
     */
    callees(name, file, depth) {
        const resolved = this.resolveSymbol(name, file);
        if (isDisambiguation(resolved))
            return resolved;
        if (resolved === null)
            return [];
        return this.calleesFromUid(resolved, depth);
    }
    /**
     * Union of callers + callees + affected files + doc references for a symbol.
     */
    blast(name, file, depth) {
        const resolved = this.resolveSymbol(name, file);
        if (isDisambiguation(resolved))
            return resolved;
        if (resolved === null) {
            return { callers: [], callees: [], affectedFiles: [], docReferences: [] };
        }
        const callers = this.callersFromUid(resolved, depth);
        const callees = this.calleesFromUid(resolved, depth);
        const docReferences = this.getDocReferences(name, file);
        const fileSet = new Set();
        const targetFile = this.getSymbolFile(resolved);
        if (targetFile)
            fileSet.add(targetFile);
        for (const r of callers)
            fileSet.add(r.filePath);
        for (const r of callees)
            fileSet.add(r.filePath);
        return {
            callers,
            callees,
            affectedFiles: Array.from(fileSet),
            docReferences,
        };
    }
    /**
     * Find all documentation references pointing to a code symbol.
     * Queries `documents` edges where the target symbol matches `symbolName`.
     * Optionally filters to a specific file.
     */
    getDocReferences(symbolName, file) {
        const sql = `
      SELECT f_doc.path as doc_file, s_doc.line_start, s_doc.container_name
      FROM edges e
      JOIN symbols s_doc ON s_doc.symbol_uid = e.source_uid
      JOIN files f_doc ON f_doc.id = s_doc.file_id
      JOIN symbols s_code ON s_code.symbol_uid = e.target_uid
      WHERE e.kind = 'documents'
        AND s_code.name = ?
        ${file ? 'AND s_code.symbol_uid IN (SELECT symbol_uid FROM symbols s2 JOIN files f2 ON f2.id = s2.file_id WHERE f2.path = ?)' : ''}
      ORDER BY f_doc.path, s_doc.line_start
    `;
        const rows = file
            ? this.rawQuery(sql, symbolName, file)
            : this.rawQuery(sql, symbolName);
        return rows.map(r => ({
            docFile: r.doc_file,
            line: r.line_start,
            context: r.container_name, // stored in container_name during indexing
        }));
    }
    /**
     * File dependency tree for a given file.
     * direction: 'in' | 'out' | 'both'
     */
    depends(file, direction) {
        const results = [];
        if (direction === 'in' || direction === 'both') {
            for (const row of this.queryFileDepsInbound(file)) {
                results.push({ filePath: row.path, kind: row.kind, direction: 'in' });
            }
        }
        if (direction === 'out' || direction === 'both') {
            for (const row of this.queryFileDepsOutbound(file)) {
                results.push({ filePath: row.path, kind: row.kind, direction: 'out' });
            }
        }
        return results;
    }
    /**
     * Symbol search by name/qualified_name substring.
     */
    search(query, kind) {
        // Pass kind to DB so filtering and LIMIT happen in SQL
        const symbols = this.db.searchSymbols(query, kind);
        const results = [];
        for (const s of symbols) {
            const filePath = this.getFileById(s.file_id);
            if (!filePath)
                continue;
            results.push({
                symbolName: s.name,
                qualifiedName: s.qualified_name,
                kind: s.kind,
                filePath,
                lineStart: s.line_start,
            });
        }
        return results;
    }
    /**
     * Build a complete codebase briefing: overview, module map, hotspots,
     * entry points, risk zones, and tightly-coupled file pairs.
     */
    brief() {
        // --- Overview ---
        const status = this.db.getStatus();
        const overview = {
            totalFiles: status.totalFiles,
            totalSymbols: status.totalSymbols,
            totalEdges: status.totalEdges,
            languages: status.languages,
            lastIndexedAt: status.lastIndexedAt,
            lastIndexedCommit: status.lastIndexedCommit,
        };
        const hotspotRows = this.rawQuery(`SELECT s.name, s.qualified_name, f.path, s.line_start, COUNT(e.id) as caller_count
       FROM symbols s
       JOIN files f ON f.id = s.file_id
       LEFT JOIN edges e ON e.target_uid = s.symbol_uid AND e.kind = 'calls'
       GROUP BY s.symbol_uid
       HAVING caller_count > 0
       ORDER BY caller_count DESC
       LIMIT 10`);
        const hotspots = hotspotRows.map(r => ({
            symbolName: r.name,
            qualifiedName: r.qualified_name,
            filePath: r.path,
            lineStart: r.line_start,
            callerCount: r.caller_count,
        }));
        const entryPointRows = this.rawQuery(`SELECT s.name, f.path, s.line_start
       FROM symbols s
       JOIN files f ON f.id = s.file_id
       LEFT JOIN edges e ON e.target_uid = s.symbol_uid AND e.kind = 'calls'
       WHERE s.exported = 1 AND e.id IS NULL
       ORDER BY f.path`);
        const entryPoints = entryPointRows.map(r => ({
            symbolName: r.name,
            filePath: r.path,
            lineStart: r.line_start,
            category: categoriseEntryPoint(r.path),
        }));
        const riskRows = this.rawQuery(`SELECT f_tgt.path, COUNT(DISTINCT fd.source_id) as dependent_count
       FROM file_deps fd
       JOIN files f_tgt ON f_tgt.id = fd.target_id
       GROUP BY fd.target_id
       ORDER BY dependent_count DESC
       LIMIT 20`);
        const riskZones = riskRows.map(r => ({
            filePath: r.path,
            dependentCount: r.dependent_count,
            risk: r.dependent_count > 20 ? 'HIGH' : r.dependent_count >= 10 ? 'MEDIUM' : 'LOW',
        }));
        const coupledRows = this.rawQuery(`SELECT DISTINCT f1.path as file_a, f2.path as file_b
       FROM file_deps fd1
       JOIN file_deps fd2 ON fd1.source_id = fd2.target_id AND fd1.target_id = fd2.source_id
       JOIN files f1 ON f1.id = fd1.source_id
       JOIN files f2 ON f2.id = fd1.target_id
       WHERE f1.path < f2.path`);
        const coupledPairs = coupledRows.map(r => ({
            fileA: r.file_a,
            fileB: r.file_b,
        }));
        // --- Module Map ---
        const allFiles = this.db.getAllFiles();
        // Map filePath → module path
        const fileToModule = new Map();
        for (const f of allFiles) {
            fileToModule.set(f.path, getModulePath(f.path));
        }
        // Group files by module
        const moduleFiles = new Map();
        for (const f of allFiles) {
            const mod = fileToModule.get(f.path);
            const arr = moduleFiles.get(mod) ?? [];
            arr.push(f.path);
            moduleFiles.set(mod, arr);
        }
        const symCountRows = this.rawQuery(`SELECT f.path, COUNT(s.id) as sym_count
       FROM files f
       LEFT JOIN symbols s ON s.file_id = f.id
       GROUP BY f.id`);
        const fileSymCount = new Map();
        for (const row of symCountRows) {
            fileSymCount.set(row.path, row.sym_count);
        }
        const moduleDepRows = this.rawQuery(`SELECT f_src.path as src_path, f_tgt.path as tgt_path
       FROM file_deps fd
       JOIN files f_src ON f_src.id = fd.source_id
       JOIN files f_tgt ON f_tgt.id = fd.target_id`);
        // Build inter-module dependency edges
        const moduleDeps = new Map();
        for (const row of moduleDepRows) {
            const srcMod = getModulePath(row.src_path);
            const tgtMod = getModulePath(row.tgt_path);
            if (srcMod !== tgtMod) {
                const set = moduleDeps.get(srcMod) ?? new Set();
                set.add(tgtMod);
                moduleDeps.set(srcMod, set);
            }
        }
        const modules = [];
        for (const [modPath, files] of moduleFiles.entries()) {
            let symbolCount = 0;
            for (const f of files) {
                symbolCount += fileSymCount.get(f) ?? 0;
            }
            const dependsOn = Array.from(moduleDeps.get(modPath) ?? new Set());
            modules.push({ path: modPath, fileCount: files.length, symbolCount, dependsOn });
        }
        modules.sort((a, b) => a.path.localeCompare(b.path));
        return { overview, modules, hotspots, entryPoints, riskZones, coupledPairs };
    }
    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------
    /**
     * Resolve a symbol name (+ optional file filter) to a single symbol_uid.
     * Returns null when no match is found, and DisambiguationResult when multiple
     * symbols match and cannot be narrowed to one.
     */
    resolveSymbol(name, file) {
        const symbols = this.db.getSymbolsByName(name);
        if (symbols.length === 0)
            return null;
        // Exclude doc_reference symbols — they are virtual references to code
        // symbols, not actual code definitions. Including them would cause
        // spurious disambiguation when a symbol is both defined in code and
        // referenced in documentation.
        const codeSymbols = symbols.filter(s => s.kind !== 'doc_reference');
        if (codeSymbols.length === 0)
            return null;
        const candidates = file
            ? codeSymbols.filter(s => this.getFileById(s.file_id) === file)
            : codeSymbols;
        if (candidates.length === 0)
            return null;
        if (candidates.length > 1) {
            const matches = candidates.map(s => ({
                name: s.name,
                kind: s.kind,
                file_path: this.getFileById(s.file_id) ?? '',
                line_start: s.line_start,
            }));
            return { disambiguation: true, matches };
        }
        return candidates[0].symbol_uid;
    }
    /**
     * Resolve a qualified_name scoped to a file to a single symbol_uid.
     * Returns null when not found, DisambiguationResult when still ambiguous.
     */
    resolveByQualifiedName(qualifiedName, file) {
        const fileRecord = this.db.getFileByPath(file);
        if (!fileRecord)
            return null;
        const symbols = this.db
            .getSymbolsByFile(fileRecord.id)
            .filter(s => s.qualified_name === qualifiedName);
        if (symbols.length === 0)
            return null;
        if (symbols.length === 1)
            return symbols[0].symbol_uid;
        const matches = symbols.map(s => ({
            name: s.name,
            kind: s.kind,
            file_path: file,
            line_start: s.line_start,
        }));
        return { disambiguation: true, matches };
    }
    callersFromUid(uid, userDepth) {
        const depthCap = Math.min(userDepth ?? 5, MAX_DEPTH);
        return this.execRecursiveCte('callers', uid, depthCap).map(r => ({
            symbolName: r.name,
            filePath: r.path,
            lineStart: r.line_start,
            depth: r.depth,
        }));
    }
    calleesFromUid(uid, userDepth) {
        const depthCap = Math.min(userDepth ?? 5, MAX_DEPTH);
        return this.execRecursiveCte('callees', uid, depthCap).map(r => ({
            symbolName: r.name,
            filePath: r.path,
            lineStart: r.line_start,
            depth: r.depth,
        }));
    }
    /**
     * Execute the recursive CTE for callers or callees.
     * 'callers': traverse edges in reverse (find who points TO uid)
     * 'callees': traverse edges forward (find what uid points TO)
     */
    execRecursiveCte(direction, uid, depthCap) {
        // For callers: anchor is edges WHERE target_uid = uid -> select source_uid
        // For callees: anchor is edges WHERE source_uid = uid -> select target_uid
        const [selectSide, whereSide] = direction === 'callers'
            ? ['source_uid', 'target_uid']
            : ['target_uid', 'source_uid'];
        const sql = `
      WITH RECURSIVE cte AS (
        SELECT ${selectSide} AS uid, 1 AS depth
        FROM edges
        WHERE ${whereSide} = ? AND kind = 'calls'
        UNION
        SELECT e.${selectSide}, c.depth + 1
        FROM edges e
        JOIN cte c ON e.${whereSide} = c.uid
        WHERE e.kind = 'calls' AND c.depth < ?
      )
      SELECT s.name, f.path, s.line_start, MIN(c.depth) AS depth
      FROM cte c
      JOIN symbols s ON s.symbol_uid = c.uid
      JOIN files f ON f.id = s.file_id
      GROUP BY c.uid
      ORDER BY depth, f.path
      LIMIT ${MAX_RESULTS}
    `;
        return this.rawQuery(sql, uid, depthCap);
    }
    queryFileDepsInbound(file) {
        return this.rawQuery(`SELECT f_src.path, fd.kind
       FROM file_deps fd
       JOIN files f_src ON f_src.id = fd.source_id
       JOIN files f_tgt ON f_tgt.id = fd.target_id
       WHERE f_tgt.path = ?`, file);
    }
    queryFileDepsOutbound(file) {
        return this.rawQuery(`SELECT f_tgt.path, fd.kind
       FROM file_deps fd
       JOIN files f_src ON f_src.id = fd.source_id
       JOIN files f_tgt ON f_tgt.id = fd.target_id
       WHERE f_src.path = ?`, file);
    }
    getFileById(fileId) {
        return this.db.getFileById(fileId)?.path;
    }
    getSymbolFile(uid) {
        const symbol = this.db.getSymbolByUid(uid);
        if (!symbol)
            return undefined;
        return this.getFileById(symbol.file_id);
    }
    /**
     * Execute a raw SQL query against the underlying better-sqlite3 instance.
     * Uses the public prepare() method exposed by Database.
     */
    rawQuery(sql, ...params) {
        return this.db.prepare(sql).all(...params);
    }
}
// ---------------------------------------------------------------------------
// Module grouping helpers (module-level, used by brief())
// ---------------------------------------------------------------------------
/**
 * Derive a module path from a file path by taking the first 2–3 directory
 * segments. Examples:
 *   'src/modules/auth/services/login.ts' → 'src/modules/auth'
 *   'packages/shared-types/src/index.ts' → 'packages/shared-types'
 *   'src/index.ts'                        → 'src'
 */
function getModulePath(filePath) {
    const parts = filePath.split('/');
    if (parts.length <= 2)
        return parts[0];
    return parts.slice(0, 3).join('/');
}
/**
 * Classify an entry-point file into a category based on its path pattern.
 *   'api-route'  — files matching the pattern .../api/.../route.ts
 *   'page'       — files matching the pattern .../page.tsx
 *   'action'     — files matching the pattern .../actions/...
 *   'export'     — everything else
 */
function categoriseEntryPoint(filePath) {
    if (/\/api\/.*\/route\.ts$/.test(filePath) || /\/api\/route\.ts$/.test(filePath)) {
        return 'api-route';
    }
    if (/\/page\.tsx$/.test(filePath)) {
        return 'page';
    }
    if (/\/actions\//.test(filePath)) {
        return 'action';
    }
    return 'export';
}
//# sourceMappingURL=query-engine.js.map