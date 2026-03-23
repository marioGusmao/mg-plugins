import BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SCHEMA_VERSION } from './types.js';
const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS files (
  id          INTEGER PRIMARY KEY,
  path        TEXT UNIQUE,
  language    TEXT,
  hash        TEXT,
  indexed_at  INTEGER
);

CREATE TABLE IF NOT EXISTS symbols (
  id             INTEGER PRIMARY KEY,
  file_id        INTEGER REFERENCES files ON DELETE CASCADE,
  symbol_uid     TEXT UNIQUE,
  name           TEXT,
  qualified_name TEXT,
  container_name TEXT DEFAULT '',
  kind           TEXT,
  line_start     INTEGER,
  line_end       INTEGER,
  exported       BOOLEAN DEFAULT 0
);

CREATE TABLE IF NOT EXISTS edges (
  id          INTEGER PRIMARY KEY,
  source_uid  TEXT REFERENCES symbols(symbol_uid) ON DELETE CASCADE,
  target_uid  TEXT REFERENCES symbols(symbol_uid) ON DELETE CASCADE,
  kind        TEXT,
  confidence  TEXT DEFAULT 'syntactic'
);

CREATE TABLE IF NOT EXISTS file_deps (
  id         INTEGER PRIMARY KEY,
  source_id  INTEGER REFERENCES files ON DELETE CASCADE,
  target_id  INTEGER REFERENCES files ON DELETE CASCADE,
  kind       TEXT
);

CREATE TABLE IF NOT EXISTS config_fingerprints (
  key   TEXT PRIMARY KEY,
  hash  TEXT
);

CREATE INDEX IF NOT EXISTS idx_symbols_uid            ON symbols(symbol_uid);
CREATE INDEX IF NOT EXISTS idx_symbols_name           ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_qualified_name ON symbols(qualified_name);
CREATE INDEX IF NOT EXISTS idx_edges_source_uid       ON edges(source_uid);
CREATE INDEX IF NOT EXISTS idx_edges_target_uid       ON edges(target_uid);
CREATE INDEX IF NOT EXISTS idx_edges_confidence       ON edges(confidence);
CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_unique    ON edges(source_uid, target_uid, kind);
`;
export class Database {
    db;
    constructor(rootDir) {
        const codegraphDir = path.join(rootDir, '.codegraph');
        fs.mkdirSync(codegraphDir, { recursive: true });
        const dbPath = path.join(codegraphDir, 'graph.db');
        this.db = new BetterSqlite3(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this.db.exec(SCHEMA_SQL);
        const existing = this.getMeta('schema_version');
        if (existing === null) {
            this.setMeta('schema_version', SCHEMA_VERSION);
        }
        else {
            const existingMajor = existing.split('.')[0];
            const currentMajor = SCHEMA_VERSION.split('.')[0];
            if (existingMajor !== currentMajor) {
                this.db.close();
                throw new Error(`Schema version mismatch: database has ${existing}, code expects ${SCHEMA_VERSION}`);
            }
        }
    }
    getMeta(key) {
        const row = this.db
            .prepare('SELECT value FROM meta WHERE key = ?')
            .get(key);
        return row?.value ?? null;
    }
    setMeta(key, value) {
        this.db
            .prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
            .run(key, value);
    }
    upsertFile(input) {
        const now = Date.now();
        this.db
            .prepare(`INSERT INTO files (path, language, hash, indexed_at)
         VALUES (@path, @language, @hash, @indexed_at)
         ON CONFLICT(path) DO UPDATE SET
           language   = excluded.language,
           hash       = excluded.hash,
           indexed_at = excluded.indexed_at`)
            .run({ path: input.path, language: input.language, hash: input.hash, indexed_at: now });
        const row = this.db
            .prepare('SELECT id FROM files WHERE path = ?')
            .get(input.path);
        return row.id;
    }
    getFileByPath(filePath) {
        return this.db
            .prepare('SELECT * FROM files WHERE path = ?')
            .get(filePath);
    }
    getAllFiles() {
        return this.db.prepare('SELECT * FROM files').all();
    }
    getFileById(id) {
        return this.db
            .prepare('SELECT * FROM files WHERE id = ?')
            .get(id);
    }
    deleteFile(id) {
        this.db.prepare('DELETE FROM files WHERE id = ?').run(id);
    }
    deleteFileSymbolsAndEdges(fileId) {
        this.db.prepare('DELETE FROM symbols WHERE file_id = ?').run(fileId);
    }
    /**
     * Get all edges where target_uid belongs to this file's symbols but
     * source_uid belongs to a DIFFERENT file's symbols. These are "inbound"
     * edges from other files that would be lost on CASCADE delete.
     */
    getInboundEdgesFromOtherFiles(fileId) {
        const rows = this.db
            .prepare(`SELECT e.source_uid, e.target_uid, e.kind, e.confidence
         FROM edges e
         JOIN symbols s_tgt ON s_tgt.symbol_uid = e.target_uid
         WHERE s_tgt.file_id = ?
           AND e.source_uid NOT IN (SELECT symbol_uid FROM symbols WHERE file_id = ?)`)
            .all(fileId, fileId);
        return rows.map(r => ({
            source_uid: r.source_uid,
            target_uid: r.target_uid,
            kind: r.kind,
            confidence: r.confidence,
        }));
    }
    insertSymbol(input) {
        const result = this.db
            .prepare(`INSERT OR IGNORE INTO symbols
           (file_id, symbol_uid, name, qualified_name, container_name,
            kind, line_start, line_end, exported)
         VALUES
           (@file_id, @symbol_uid, @name, @qualified_name, @container_name,
            @kind, @line_start, @line_end, @exported)`)
            .run({
            file_id: input.file_id,
            symbol_uid: input.symbol_uid,
            name: input.name,
            qualified_name: input.qualified_name,
            container_name: input.container_name,
            kind: input.kind,
            line_start: input.line_start,
            line_end: input.line_end,
            exported: input.exported ? 1 : 0,
        });
        if (result.changes > 0) {
            return Number(result.lastInsertRowid);
        }
        const row = this.db
            .prepare('SELECT id FROM symbols WHERE symbol_uid = ?')
            .get(input.symbol_uid);
        return row.id;
    }
    getSymbolByUid(symbolUid) {
        return this.db
            .prepare('SELECT * FROM symbols WHERE symbol_uid = ?')
            .get(symbolUid);
    }
    getSymbolsByFile(fileId) {
        return this.db
            .prepare('SELECT * FROM symbols WHERE file_id = ?')
            .all(fileId);
    }
    getSymbolsByName(name) {
        return this.db
            .prepare('SELECT * FROM symbols WHERE name = ?')
            .all(name);
    }
    getSymbolsByQualifiedName(qualifiedName) {
        return this.db
            .prepare('SELECT * FROM symbols WHERE qualified_name = ?')
            .all(qualifiedName);
    }
    searchSymbols(pattern, kind) {
        const escaped = pattern.replace(/[%_\\]/g, '\\$&');
        const likeParam = `%${escaped}%`;
        if (kind) {
            return this.db
                .prepare(`SELECT * FROM symbols WHERE (name LIKE ? ESCAPE '\\' OR qualified_name LIKE ? ESCAPE '\\') AND kind = ? LIMIT 200`)
                .all(likeParam, likeParam, kind);
        }
        return this.db
            .prepare(`SELECT * FROM symbols WHERE name LIKE ? ESCAPE '\\' OR qualified_name LIKE ? ESCAPE '\\' LIMIT 200`)
            .all(likeParam, likeParam);
    }
    insertEdge(input) {
        // INSERT OR REPLACE naturally handles the semantic-upgrades-syntactic case:
        // when a semantic edge conflicts with an existing syntactic edge on the same
        // (source_uid, target_uid, kind) triple, the UNIQUE index causes a REPLACE,
        // updating confidence to 'semantic'. No separate DELETE step is needed.
        const result = this.db
            .prepare(`INSERT OR REPLACE INTO edges (source_uid, target_uid, kind, confidence)
         VALUES (@source_uid, @target_uid, @kind, @confidence)`)
            .run({
            source_uid: input.source_uid,
            target_uid: input.target_uid,
            kind: input.kind,
            confidence: input.confidence,
        });
        return Number(result.lastInsertRowid);
    }
    getEdgesBySourceUid(sourceUid) {
        return this.db
            .prepare('SELECT * FROM edges WHERE source_uid = ?')
            .all(sourceUid);
    }
    getEdgesByTargetUid(targetUid) {
        return this.db
            .prepare('SELECT * FROM edges WHERE target_uid = ?')
            .all(targetUid);
    }
    insertFileDep(input) {
        const result = this.db
            .prepare(`INSERT OR IGNORE INTO file_deps (source_id, target_id, kind)
         VALUES (@source_id, @target_id, @kind)`)
            .run(input);
        return Number(result.lastInsertRowid);
    }
    getStaleFiles(currentFiles) {
        const stale = [];
        const stmt = this.db
            .prepare('SELECT * FROM files WHERE path = ?');
        for (const { path: filePath, hash } of currentFiles) {
            const record = stmt.get(filePath);
            if (record && record.hash !== hash) {
                stale.push(record);
            }
        }
        return stale;
    }
    getConfigFingerprint(key) {
        const row = this.db
            .prepare('SELECT hash FROM config_fingerprints WHERE key = ?')
            .get(key);
        return row?.hash ?? null;
    }
    setConfigFingerprint(key, hash) {
        this.db
            .prepare('INSERT OR REPLACE INTO config_fingerprints (key, hash) VALUES (?, ?)')
            .run(key, hash);
    }
    prepare(sql) {
        return this.db.prepare(sql);
    }
    transaction(fn) {
        return this.db.transaction(fn)();
    }
    getStatus(projectRoot) {
        const totalFiles = (this.db.prepare('SELECT COUNT(*) as count FROM files').get()
            ?.count) ?? 0;
        const totalSymbols = (this.db.prepare('SELECT COUNT(*) as count FROM symbols').get()
            ?.count) ?? 0;
        const totalEdges = (this.db.prepare('SELECT COUNT(*) as count FROM edges').get()
            ?.count) ?? 0;
        const lastIndexedRow = this.db
            .prepare('SELECT MAX(indexed_at) as indexed_at FROM files')
            .get();
        const lastIndexedAt = lastIndexedRow?.indexed_at != null
            ? new Date(lastIndexedRow.indexed_at).toISOString()
            : null;
        const lastIndexedCommit = this.getMeta('last_indexed_commit');
        const schemaVersion = this.getMeta('schema_version') ?? SCHEMA_VERSION;
        const languageRows = this.db
            .prepare('SELECT language, COUNT(*) as count FROM files GROUP BY language')
            .all();
        const languages = {};
        for (const row of languageRows) {
            languages[row.language] = row.count;
        }
        let staleCount = 0;
        if (projectRoot) {
            // Order by most recently indexed so the capped scan catches recent edits first
            const files = this.db
                .prepare('SELECT * FROM files ORDER BY indexed_at DESC')
                .all();
            // Cap stale scan to avoid blocking the event loop on large codebases
            const MAX_STALE_SCAN = 2000;
            const filesToScan = files.length <= MAX_STALE_SCAN ? files : files.slice(0, MAX_STALE_SCAN);
            for (const f of filesToScan) {
                const absPath = path.join(projectRoot, f.path);
                try {
                    const content = fs.readFileSync(absPath, 'utf-8');
                    const hash = createHash('sha256').update(content).digest('hex');
                    if (hash !== f.hash)
                        staleCount++;
                }
                catch {
                    staleCount++; // file deleted = stale
                }
            }
            // If we capped, stale count is approximate
            if (files.length > MAX_STALE_SCAN && staleCount > 0) {
                staleCount = Math.round((staleCount / MAX_STALE_SCAN) * files.length);
            }
        }
        return {
            totalFiles,
            totalSymbols,
            totalEdges,
            staleFiles: staleCount,
            lastIndexedAt,
            lastIndexedCommit,
            schemaVersion,
            languages,
        };
    }
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=db.js.map