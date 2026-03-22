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
// ---------------------------------------------------------------------------
// Handler implementations (pure functions, testable without stdio)
// ---------------------------------------------------------------------------
async function handleStatus(projectDir, _input) {
    if (!dbExists(projectDir)) {
        return noIndexResponse();
    }
    const db = new Database(projectDir);
    try {
        // The depth cap (MAX_DEPTH=15) in recursive CTEs is the primary protection
        // against runaway queries. better-sqlite3 is synchronous, so setTimeout-based
        // timeouts cannot interrupt running queries.
        const status = db.getStatus();
        const markdown = formatStatus(status);
        return {
            content: [{ type: 'text', text: markdown }],
            structuredContent: status,
        };
    }
    finally {
        db.close();
    }
}
async function handleBrief(projectDir, _input) {
    if (!dbExists(projectDir)) {
        return noIndexResponse();
    }
    const db = new Database(projectDir);
    try {
        const qe = new QueryEngine(db);
        const brief = qe.brief();
        const markdown = formatBrief(brief);
        return {
            content: [{ type: 'text', text: markdown }],
            structuredContent: brief,
        };
    }
    finally {
        db.close();
    }
}
async function handleSearch(projectDir, input) {
    if (!dbExists(projectDir)) {
        return noIndexResponse();
    }
    const db = new Database(projectDir);
    try {
        const qe = new QueryEngine(db);
        const results = qe.search(input.query, input.kind);
        const markdown = formatSearch(input.query, results);
        return {
            content: [{ type: 'text', text: markdown }],
            structuredContent: { symbols: results },
        };
    }
    finally {
        db.close();
    }
}
async function handleCallers(projectDir, input) {
    if (!dbExists(projectDir)) {
        return noIndexResponse();
    }
    const db = new Database(projectDir);
    try {
        const qe = new QueryEngine(db);
        const depth = input.depth;
        let results;
        if (input.symbol_uid) {
            results = qe.callersByUid(input.symbol_uid, depth);
        }
        else if (input.qualified_name && input.file) {
            results = qe.callersByQualifiedName(input.qualified_name, input.file, depth);
        }
        else if (input.symbol) {
            results = qe.callers(input.symbol, input.file, depth);
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
        // Look up the actual definition line from the DB
        let definitionLine = 0;
        if (input.symbol_uid) {
            const sym = db.getSymbolByUid(input.symbol_uid);
            definitionLine = sym?.line_start ?? 0;
        }
        else {
            const lookupName = input.qualified_name ?? input.symbol ?? '';
            if (lookupName) {
                const syms = db.getSymbolsByName(lookupName);
                definitionLine = syms[0]?.line_start ?? 0;
            }
        }
        const markdown = formatCallers(symbolName, filePath, definitionLine, results);
        return {
            content: [{ type: 'text', text: markdown }],
            structuredContent: { callers: results },
        };
    }
    finally {
        db.close();
    }
}
async function handleCallees(projectDir, input) {
    if (!dbExists(projectDir)) {
        return noIndexResponse();
    }
    const db = new Database(projectDir);
    try {
        const qe = new QueryEngine(db);
        const depth = input.depth;
        let results;
        if (input.symbol_uid) {
            results = qe.calleesByUid(input.symbol_uid, depth);
        }
        else if (input.qualified_name && input.file) {
            // Use search + callees with file
            results = qe.callees(input.qualified_name, input.file, depth);
        }
        else if (input.symbol) {
            results = qe.callees(input.symbol, input.file, depth);
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
        // Look up the actual definition line from the DB
        let definitionLine = 0;
        if (input.symbol_uid) {
            const sym = db.getSymbolByUid(input.symbol_uid);
            definitionLine = sym?.line_start ?? 0;
        }
        else {
            const lookupName = input.qualified_name ?? input.symbol ?? '';
            if (lookupName) {
                const syms = db.getSymbolsByName(lookupName);
                definitionLine = syms[0]?.line_start ?? 0;
            }
        }
        const markdown = formatCallees(symbolName, filePath, definitionLine, results);
        return {
            content: [{ type: 'text', text: markdown }],
            structuredContent: { callees: results },
        };
    }
    finally {
        db.close();
    }
}
async function handleBlast(projectDir, input) {
    if (!dbExists(projectDir)) {
        return noIndexResponse();
    }
    const db = new Database(projectDir);
    try {
        const qe = new QueryEngine(db);
        const depth = input.depth;
        let symbolName;
        let filePath;
        if (input.symbol_uid) {
            const sym = db.getSymbolByUid(input.symbol_uid);
            if (!sym) {
                const text = `Symbol with uid '${input.symbol_uid}' not found.`;
                return { content: [{ type: 'text', text }], structuredContent: { error: text } };
            }
            symbolName = sym.name;
            filePath = undefined;
        }
        else if (input.qualified_name && input.file) {
            symbolName = input.qualified_name;
            filePath = input.file;
        }
        else if (input.symbol) {
            symbolName = input.symbol;
            filePath = input.file;
        }
        else {
            const text = 'Must provide symbol_uid, (qualified_name + file), or symbol.';
            return { content: [{ type: 'text', text }], structuredContent: { error: text } };
        }
        const blastResult = qe.blast(symbolName, filePath, depth);
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
        db.close();
    }
}
async function handleDepends(projectDir, input) {
    if (!dbExists(projectDir)) {
        return noIndexResponse();
    }
    const db = new Database(projectDir);
    try {
        const qe = new QueryEngine(db);
        const direction = input.direction ?? 'both';
        const results = qe.depends(input.file, direction);
        const markdown = formatDepends(input.file, results);
        return {
            content: [{ type: 'text', text: markdown }],
            structuredContent: { file: input.file, direction, dependencies: results },
        };
    }
    finally {
        db.close();
    }
}
export function createToolHandlers(projectDir) {
    return {
        codegraph_brief: (input) => handleBrief(projectDir, input),
        codegraph_status: (input) => handleStatus(projectDir, input),
        codegraph_search: (input) => handleSearch(projectDir, input),
        codegraph_callers: (input) => handleCallers(projectDir, input),
        codegraph_callees: (input) => handleCallees(projectDir, input),
        codegraph_blast: (input) => handleBlast(projectDir, input),
        codegraph_depends: (input) => handleDepends(projectDir, input),
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
// startServer — creates and connects MCP stdio server
// ---------------------------------------------------------------------------
export async function startServer(projectDir) {
    const server = new McpServer({
        name: 'codegraph',
        version: '1.0.0',
    });
    const handlers = createToolHandlers(projectDir);
    // --- codegraph_brief ---
    server.registerTool('codegraph_brief', {
        description: 'Get a complete codebase briefing — architecture, hotspots, risk zones, entry points, and module dependencies in one call',
        inputSchema: {},
    }, async () => {
        const result = await handlers.codegraph_brief({});
        return result;
    });
    // --- codegraph_status ---
    server.registerTool('codegraph_status', {
        description: 'Show the current state of the CodeGraph index for the project',
        inputSchema: {},
    }, async () => {
        const result = await handlers.codegraph_status({});
        return result;
    });
    // --- codegraph_search ---
    server.registerTool('codegraph_search', {
        description: 'Search for symbols by name or kind in the indexed codebase',
        inputSchema: {
            query: z.string().describe('Search query (substring match on name/qualified name)'),
            kind: z
                .enum(['function', 'class', 'method', 'variable', 'type', 'export'])
                .optional()
                .describe('Filter by symbol kind'),
        },
    }, async (args) => {
        const result = await handlers.codegraph_search(args);
        return result;
    });
    // --- codegraph_callers ---
    server.registerTool('codegraph_callers', {
        description: 'Find all callers of a symbol (recursive up to depth)',
        inputSchema: symbolDisambigSchema,
    }, async (args) => {
        const result = await handlers.codegraph_callers(args);
        return result;
    });
    // --- codegraph_callees ---
    server.registerTool('codegraph_callees', {
        description: 'Find all symbols called by a symbol (recursive up to depth)',
        inputSchema: symbolDisambigSchema,
    }, async (args) => {
        const result = await handlers.codegraph_callees(args);
        return result;
    });
    // --- codegraph_blast ---
    server.registerTool('codegraph_blast', {
        description: 'Compute blast radius: union of callers + callees for a symbol',
        inputSchema: symbolDisambigSchema,
    }, async (args) => {
        const result = await handlers.codegraph_blast(args);
        return result;
    });
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
    }, async (args) => {
        const result = await handlers.codegraph_depends(args);
        return result;
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
// ---------------------------------------------------------------------------
// CLI entry point — parse --project from argv
// ---------------------------------------------------------------------------
/**
 * Parse the --project argument from process.argv.
 * Falls back to process.cwd() when not specified.
 */
export function parseProjectDir(argv) {
    const idx = argv.indexOf('--project');
    if (idx !== -1 && argv[idx + 1]) {
        return path.resolve(argv[idx + 1]);
    }
    return process.cwd();
}
//# sourceMappingURL=server.js.map