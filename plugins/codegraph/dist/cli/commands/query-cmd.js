import path from 'node:path';
import fs from 'node:fs';
import { Database } from '../../core/db.js';
import { QueryEngine, isDisambiguation } from '../../core/query-engine.js';
import { formatBrief, formatCallers, formatCallees, formatBlast, formatDepends, formatSearch, formatStatus, formatDisambiguation, } from '../../core/formatter.js';
// ---------------------------------------------------------------------------
// Tool name normalisation
// ---------------------------------------------------------------------------
/** Strip the optional `codegraph_` prefix from a tool name. */
function normaliseToolName(raw) {
    return raw.startsWith('codegraph_') ? raw.slice('codegraph_'.length) : raw;
}
// ---------------------------------------------------------------------------
// Register command
// ---------------------------------------------------------------------------
export function registerQueryCmd(program) {
    program
        .command('query <tool> [symbol]')
        .description('Run a named query against the CodeGraph index. ' +
        'Tool names: brief, callers, callees, blast, depends, search, status ' +
        '(codegraph_ prefix is optional).')
        .option('--project <dir>', 'Project root directory', process.cwd())
        .option('--file <path>', 'File path for symbol disambiguation')
        .option('--qualified-name <name>', 'Qualified symbol name (e.g. Foo.render)')
        .option('--uid <uid>', 'Exact symbol UID for unambiguous lookup')
        .option('--depth <n>', 'Recursion depth (1-15)', '5')
        .option('--direction <dir>', 'Dependency direction: in | out | both', 'both')
        .option('--kind <kind>', 'Filter search results by symbol kind')
        .option('--json', 'Output raw JSON instead of Markdown', false)
        .action((tool, symbol, options) => {
        const projectRoot = path.resolve(options.project);
        const toolName = normaliseToolName(tool);
        const depth = Math.min(Math.max(parseInt(options.depth, 10) || 5, 1), 15);
        const direction = options.direction;
        const outputJson = options.json;
        // Verify DB exists
        const dbPath = path.join(projectRoot, '.codegraph', 'graph.db');
        if (!fs.existsSync(dbPath)) {
            const msg = 'No CodeGraph index found. Run `codegraph index` in your project directory to create one.';
            if (outputJson) {
                console.log(JSON.stringify({ error: msg }));
            }
            else {
                console.error(msg);
            }
            process.exit(1);
        }
        const db = new Database(projectRoot);
        try {
            const qe = new QueryEngine(db);
            runQuery(toolName, symbol, options, qe, db, depth, direction, outputJson, projectRoot);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`Error: ${message}`);
            process.exitCode = 1;
        }
        finally {
            db.close();
        }
    });
}
// ---------------------------------------------------------------------------
// Query dispatcher
// ---------------------------------------------------------------------------
function runQuery(toolName, symbol, options, qe, db, depth, direction, outputJson, projectRoot) {
    switch (toolName) {
        case 'brief': {
            const brief = qe.brief();
            if (outputJson) {
                console.log(JSON.stringify(brief, null, 2));
            }
            else {
                console.log(formatBrief(brief));
            }
            break;
        }
        case 'status': {
            const status = db.getStatus(projectRoot);
            if (outputJson) {
                console.log(JSON.stringify(status, null, 2));
            }
            else {
                console.log(formatStatus(status));
            }
            break;
        }
        case 'search': {
            if (!symbol) {
                throw new Error('search requires a <symbol> query argument.');
            }
            const results = qe.search(symbol, options.kind);
            if (outputJson) {
                console.log(JSON.stringify({ symbols: results }, null, 2));
            }
            else {
                console.log(formatSearch(symbol, results));
            }
            break;
        }
        case 'callers': {
            const callersResult = resolveAndRunCallers(qe, symbol, options, depth);
            if (!Array.isArray(callersResult)) {
                // DisambiguationResult
                if (outputJson) {
                    console.log(JSON.stringify({ disambiguation: true, matches: callersResult.matches }, null, 2));
                }
                else {
                    console.log(formatDisambiguation(symbol ?? options.qualifiedName ?? '', callersResult.matches));
                }
                break;
            }
            if (outputJson) {
                console.log(JSON.stringify({ callers: callersResult }, null, 2));
            }
            else {
                const symLabel = options.uid ?? options.qualifiedName ?? symbol ?? '';
                const fileLabel = options.file ?? '';
                console.log(formatCallers(symLabel, fileLabel, 0, callersResult));
            }
            break;
        }
        case 'callees': {
            const calleesResult = resolveAndRunCallees(qe, symbol, options, depth);
            if (!Array.isArray(calleesResult)) {
                if (outputJson) {
                    console.log(JSON.stringify({ disambiguation: true, matches: calleesResult.matches }, null, 2));
                }
                else {
                    console.log(formatDisambiguation(symbol ?? options.qualifiedName ?? '', calleesResult.matches));
                }
                break;
            }
            if (outputJson) {
                console.log(JSON.stringify({ callees: calleesResult }, null, 2));
            }
            else {
                const symLabel = options.uid ?? options.qualifiedName ?? symbol ?? '';
                const fileLabel = options.file ?? '';
                console.log(formatCallees(symLabel, fileLabel, 0, calleesResult));
            }
            break;
        }
        case 'blast': {
            if (!symbol && !options.uid && !options.qualifiedName) {
                throw new Error('blast requires a <symbol>, --uid, or --qualified-name argument.');
            }
            let symName;
            let symFile;
            if (options.uid) {
                const sym = db.getSymbolByUid(options.uid);
                if (!sym) {
                    throw new Error(`Symbol with uid '${options.uid}' not found.`);
                }
                symName = sym.name;
                symFile = undefined;
            }
            else if (options.qualifiedName && options.file) {
                symName = options.qualifiedName;
                symFile = options.file;
            }
            else {
                symName = symbol;
                symFile = options.file;
            }
            const blastResult = qe.blast(symName, symFile, depth);
            if (isDisambiguation(blastResult)) {
                if (outputJson) {
                    console.log(JSON.stringify(blastResult, null, 2));
                }
                else {
                    console.log(formatDisambiguation(symName, blastResult.matches));
                }
            }
            else if (outputJson) {
                console.log(JSON.stringify(blastResult, null, 2));
            }
            else {
                console.log(formatBlast(symName, blastResult.callers, blastResult.callees, blastResult.affectedFiles, blastResult.docReferences));
            }
            break;
        }
        case 'depends': {
            const targetFile = options.file ?? symbol;
            if (!targetFile) {
                throw new Error('depends requires a --file <path> or <symbol> argument specifying the file.');
            }
            const dependsResult = qe.depends(targetFile, direction);
            if (outputJson) {
                console.log(JSON.stringify({ file: targetFile, direction, dependencies: dependsResult }, null, 2));
            }
            else {
                console.log(formatDepends(targetFile, dependsResult));
            }
            break;
        }
        default: {
            throw new Error(`unknown tool '${toolName}'. Valid tools: brief, callers, callees, blast, depends, search, status`);
        }
    }
}
// ---------------------------------------------------------------------------
// Disambiguation helpers (follow priority: uid > qualified-name+file > symbol+file > symbol)
// ---------------------------------------------------------------------------
function resolveAndRunCallers(qe, symbol, options, depth) {
    if (options.uid) {
        return qe.callersByUid(options.uid, depth);
    }
    if (options.qualifiedName && options.file) {
        return qe.callersByQualifiedName(options.qualifiedName, options.file, depth);
    }
    if (!symbol) {
        throw new Error('callers requires a <symbol>, --uid, or --qualified-name + --file argument.');
    }
    return qe.callers(symbol, options.file, depth);
}
function resolveAndRunCallees(qe, symbol, options, depth) {
    if (options.uid) {
        return qe.calleesByUid(options.uid, depth);
    }
    if (options.qualifiedName && options.file) {
        return qe.callees(options.qualifiedName, options.file, depth);
    }
    if (!symbol) {
        throw new Error('callees requires a <symbol>, --uid, or --qualified-name + --file argument.');
    }
    return qe.callees(symbol, options.file, depth);
}
//# sourceMappingURL=query-cmd.js.map