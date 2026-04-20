import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { Database } from '../core/db.js';
import { QueryEngine, isDisambiguation } from '../core/query-engine.js';
import { formatBrief, formatCallers, formatCallees, formatBlast, formatDepends, formatSearch, formatStatus, formatDisambiguation, } from '../core/formatter.js';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Returns true when the database file exists for a project directory. */
function dbExists(projectDir) {
    return fs.existsSync(path.join(projectDir, '.codegraph', 'graph.db'));
}
/** Build a no-index error response. */
function noIndexResponse() {
    const text = 'No CodeGraph index found. Run `codegraph index` in your project directory to create one.';
    return {
        content: [{ type: 'text', text }],
        structuredContent: { error: text },
    };
}
function createQueryContext(projectDir) {
    const db = new Database(projectDir);
    return { db, qe: new QueryEngine(db) };
}
function filterSymbolsToFile(db, symbols, filePath) {
    if (!filePath)
        return symbols;
    return symbols.filter((symbol) => db.getFileById(symbol.file_id)?.path === filePath);
}
function resolveSymbolRecord(db, input) {
    if (input.symbol_uid) {
        return db.getSymbolByUid(input.symbol_uid);
    }
    if (input.qualified_name) {
        const matches = filterSymbolsToFile(db, db.getSymbolsByQualifiedName(input.qualified_name), input.file);
        return matches.length === 1 ? matches[0] : undefined;
    }
    if (input.symbol) {
        const matches = filterSymbolsToFile(db, db.getSymbolsByName(input.symbol), input.file);
        return matches.length === 1 ? matches[0] : undefined;
    }
    return undefined;
}
// ---------------------------------------------------------------------------
// Handler implementations (pure functions, testable without stdio)
// ---------------------------------------------------------------------------
async function handleStatus(projectDir, _input, context) {
    if (!dbExists(projectDir)) {
        return noIndexResponse();
    }
    const ownedContext = context ?? createQueryContext(projectDir);
    try {
        // The depth cap (MAX_DEPTH=15) in recursive CTEs is the primary protection
        // against runaway queries. better-sqlite3 is synchronous, so setTimeout-based
        // timeouts cannot interrupt running queries.
        const status = ownedContext.db.getStatus(projectDir);
        const markdown = formatStatus(status);
        return {
            content: [{ type: 'text', text: markdown }],
            structuredContent: status,
        };
    }
    finally {
        if (!context)
            ownedContext.db.close();
    }
}
async function handleBrief(projectDir, _input, context) {
    if (!dbExists(projectDir)) {
        return noIndexResponse();
    }
    const ownedContext = context ?? createQueryContext(projectDir);
    try {
        const brief = ownedContext.qe.brief();
        const markdown = formatBrief(brief);
        return {
            content: [{ type: 'text', text: markdown }],
            structuredContent: brief,
        };
    }
    finally {
        if (!context)
            ownedContext.db.close();
    }
}
async function handleSearch(projectDir, input, context) {
    if (!dbExists(projectDir)) {
        return noIndexResponse();
    }
    const ownedContext = context ?? createQueryContext(projectDir);
    try {
        const results = ownedContext.qe.search(input.query, input.kind);
        const markdown = formatSearch(input.query, results);
        return {
            content: [{ type: 'text', text: markdown }],
            structuredContent: { symbols: results },
        };
    }
    finally {
        if (!context)
            ownedContext.db.close();
    }
}
async function handleCallers(projectDir, input, context) {
    if (!dbExists(projectDir)) {
        return noIndexResponse();
    }
    const ownedContext = context ?? createQueryContext(projectDir);
    try {
        const depth = input.depth;
        let results;
        if (input.symbol_uid) {
            results = ownedContext.qe.callersByUid(input.symbol_uid, depth);
        }
        else if (input.qualified_name && input.file) {
            results = ownedContext.qe.callersByQualifiedName(input.qualified_name, input.file, depth);
        }
        else if (input.symbol) {
            results = ownedContext.qe.callers(input.symbol, input.file, depth);
        }
        else {
            const text = 'Must provide symbol_uid, (qualified_name + file), or symbol.';
            return { content: [{ type: 'text', text }], structuredContent: { error: text } };
        }
        if (!Array.isArray(results)) {
            // DisambiguationResult
            const markdown = formatDisambiguation(input.symbol ?? input.qualified_name ?? '', results.matches);
            return {
                content: [{ type: 'text', text: markdown }],
                structuredContent: { disambiguation: true, matches: results.matches },
            };
        }
        const symbolName = input.symbol_uid ?? input.qualified_name ?? input.symbol ?? '';
        const filePath = input.file ?? '';
        const definitionLine = resolveSymbolRecord(ownedContext.db, input)?.line_start ?? 0;
        const markdown = formatCallers(symbolName, filePath, definitionLine, results);
        return {
            content: [{ type: 'text', text: markdown }],
            structuredContent: { callers: results },
        };
    }
    finally {
        if (!context)
            ownedContext.db.close();
    }
}
async function handleCallees(projectDir, input, context) {
    if (!dbExists(projectDir)) {
        return noIndexResponse();
    }
    const ownedContext = context ?? createQueryContext(projectDir);
    try {
        const depth = input.depth;
        let results;
        if (input.symbol_uid) {
            results = ownedContext.qe.calleesByUid(input.symbol_uid, depth);
        }
        else if (input.qualified_name && input.file) {
            results = ownedContext.qe.calleesByQualifiedName(input.qualified_name, input.file, depth);
        }
        else if (input.symbol) {
            results = ownedContext.qe.callees(input.symbol, input.file, depth);
        }
        else {
            const text = 'Must provide symbol_uid, (qualified_name + file), or symbol.';
            return { content: [{ type: 'text', text }], structuredContent: { error: text } };
        }
        if (!Array.isArray(results)) {
            const markdown = formatDisambiguation(input.symbol ?? input.qualified_name ?? '', results.matches);
            return {
                content: [{ type: 'text', text: markdown }],
                structuredContent: { disambiguation: true, matches: results.matches },
            };
        }
        const symbolName = input.symbol_uid ?? input.qualified_name ?? input.symbol ?? '';
        const filePath = input.file ?? '';
        const definitionLine = resolveSymbolRecord(ownedContext.db, input)?.line_start ?? 0;
        const markdown = formatCallees(symbolName, filePath, definitionLine, results);
        return {
            content: [{ type: 'text', text: markdown }],
            structuredContent: { callees: results },
        };
    }
    finally {
        if (!context)
            ownedContext.db.close();
    }
}
async function handleBlast(projectDir, input, context) {
    if (!dbExists(projectDir)) {
        return noIndexResponse();
    }
    const ownedContext = context ?? createQueryContext(projectDir);
    try {
        const depth = input.depth;
        let symbolName;
        // When symbol_uid is provided, use blastByUid directly to avoid
        // resolving by short name (which causes spurious disambiguation).
        if (input.symbol_uid) {
            const sym = ownedContext.db.getSymbolByUid(input.symbol_uid);
            if (!sym) {
                const text = `Symbol with uid '${input.symbol_uid}' not found.`;
                return { content: [{ type: 'text', text }], structuredContent: { error: text } };
            }
            const blastResult = ownedContext.qe.blastByUid(input.symbol_uid, depth);
            symbolName = sym.name;
            const markdown = formatBlast(symbolName, blastResult.callers, blastResult.callees, blastResult.affectedFiles, blastResult.docReferences);
            return {
                content: [{ type: 'text', text: markdown }],
                structuredContent: blastResult,
            };
        }
        if (input.qualified_name && input.file) {
            symbolName = input.qualified_name;
        }
        else if (input.symbol) {
            symbolName = input.symbol;
        }
        else {
            const text = 'Must provide symbol_uid, (qualified_name + file), or symbol.';
            return { content: [{ type: 'text', text }], structuredContent: { error: text } };
        }
        const blastResult = ownedContext.qe.blast(symbolName, input.file, depth);
        if (isDisambiguation(blastResult)) {
            const markdown = formatDisambiguation(symbolName, blastResult.matches);
            return {
                content: [{ type: 'text', text: markdown }],
                structuredContent: blastResult,
            };
        }
        const markdown = formatBlast(symbolName, blastResult.callers, blastResult.callees, blastResult.affectedFiles, blastResult.docReferences);
        return {
            content: [{ type: 'text', text: markdown }],
            structuredContent: blastResult,
        };
    }
    finally {
        if (!context)
            ownedContext.db.close();
    }
}
async function handleDepends(projectDir, input, context) {
    if (!dbExists(projectDir)) {
        return noIndexResponse();
    }
    const ownedContext = context ?? createQueryContext(projectDir);
    try {
        const direction = input.direction ?? 'both';
        const results = ownedContext.qe.depends(input.file, direction);
        const markdown = formatDepends(input.file, results);
        return {
            content: [{ type: 'text', text: markdown }],
            structuredContent: { file: input.file, direction, dependencies: results },
        };
    }
    finally {
        if (!context)
            ownedContext.db.close();
    }
}
export function createToolHandlers(projectDir, options = {}) {
    const sharedContext = options.sharedConnection && dbExists(projectDir)
        ? createQueryContext(projectDir)
        : undefined;
    return {
        codegraph_brief: (input) => handleBrief(projectDir, input, sharedContext),
        codegraph_status: (input) => handleStatus(projectDir, input, sharedContext),
        codegraph_search: (input) => handleSearch(projectDir, input, sharedContext),
        codegraph_callers: (input) => handleCallers(projectDir, input, sharedContext),
        codegraph_callees: (input) => handleCallees(projectDir, input, sharedContext),
        codegraph_blast: (input) => handleBlast(projectDir, input, sharedContext),
        codegraph_depends: (input) => handleDepends(projectDir, input, sharedContext),
        close: sharedContext ? () => sharedContext.db.close() : undefined,
    };
}
// ---------------------------------------------------------------------------
// Zod schemas for MCP tool registration
// ---------------------------------------------------------------------------
const symbolDisambigSchema = {
    symbol: z.string().optional().describe('Symbol name to find callers of'),
    file: z.string().optional().describe('File path to disambiguate'),
    qualified_name: z
        .string()
        .optional()
        .describe("Qualified name (e.g., 'Foo.render') for same-file disambiguation"),
    symbol_uid: z.string().optional().describe('Exact symbol UID for unambiguous lookup'),
    depth: z
        .number()
        .int()
        .min(1)
        .max(15)
        .optional()
        .default(5)
        .describe('Recursion depth (1-15, default 5)'),
};
// ---------------------------------------------------------------------------
// Version helper — reads version from package.json at runtime
// ---------------------------------------------------------------------------
const __dirname = path.dirname(new URL(import.meta.url).pathname);
export function getPackageVersion() {
    try {
        const pkgJsonPath = path.resolve(__dirname, '..', '..', 'package.json');
        return JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')).version;
    }
    catch {
        return '0.0.0';
    }
}
// ---------------------------------------------------------------------------
// startServer — creates and connects MCP stdio server
// ---------------------------------------------------------------------------
export async function startServer(projectDir) {
    const server = new McpServer({
        name: 'codegraph',
        version: getPackageVersion(),
    });
    const handlers = createToolHandlers(projectDir, { sharedConnection: true });
    /** Wrap a handler to catch exceptions and return a structured error instead of crashing. */
    function safeHandler(fn) {
        return async (args) => {
            try {
                return await fn(args);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return { content: [{ type: 'text', text: `Error: ${msg}` }], structuredContent: { error: msg } };
            }
        };
    }
    // --- codegraph_brief ---
    server.registerTool('codegraph_brief', {
        description: 'Get a complete codebase briefing — architecture, hotspots, risk zones, entry points, and module dependencies in one call',
        inputSchema: {},
    }, safeHandler(async () => handlers.codegraph_brief({})));
    // --- codegraph_status ---
    server.registerTool('codegraph_status', {
        description: 'Show the current state of the CodeGraph index for the project',
        inputSchema: {},
    }, safeHandler(async () => handlers.codegraph_status({})));
    // --- codegraph_search ---
    server.registerTool('codegraph_search', {
        description: 'Search for symbols by name or kind in the indexed codebase',
        inputSchema: {
            query: z.string().min(1).describe('Search query (substring match on name/qualified name)'),
            kind: z
                .enum(['function', 'class', 'method', 'variable', 'type', 'enum', 'namespace', 'export'])
                .optional()
                .describe('Filter by symbol kind'),
        },
    }, safeHandler(async (args) => handlers.codegraph_search(args)));
    // --- codegraph_callers ---
    server.registerTool('codegraph_callers', {
        description: 'Find all callers of a symbol (recursive up to depth)',
        inputSchema: symbolDisambigSchema,
    }, safeHandler(async (args) => handlers.codegraph_callers(args)));
    // --- codegraph_callees ---
    server.registerTool('codegraph_callees', {
        description: 'Find all symbols called by a symbol (recursive up to depth)',
        inputSchema: symbolDisambigSchema,
    }, safeHandler(async (args) => handlers.codegraph_callees(args)));
    // --- codegraph_blast ---
    server.registerTool('codegraph_blast', {
        description: 'Compute full blast radius for a symbol: callers, callees, affected files, and documentation references',
        inputSchema: symbolDisambigSchema,
    }, safeHandler(async (args) => handlers.codegraph_blast(args)));
    // --- codegraph_depends ---
    server.registerTool('codegraph_depends', {
        description: 'Show file dependency tree (inbound, outbound, or both)',
        inputSchema: {
            file: z.string().describe('File path to query dependencies for'),
            direction: z
                .enum(['in', 'out', 'both'])
                .optional()
                .default('both')
                .describe("Direction: 'in' (who imports this), 'out' (what this imports), or 'both'"),
        },
    }, safeHandler(async (args) => handlers.codegraph_depends(args)));
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
// ---------------------------------------------------------------------------
// CLI entry point — parse --project from argv
// ---------------------------------------------------------------------------
/**
 * Parse the --project argument from process.argv.
 * Falls back to process.cwd() when not specified or when the value is empty/whitespace.
 */
export function parseProjectDir(argv) {
    const idx = argv.indexOf('--project');
    if (idx !== -1 && argv[idx + 1] && argv[idx + 1].trim() !== '') {
        return path.resolve(argv[idx + 1]);
    }
    return process.cwd();
}
//# sourceMappingURL=server.js.map