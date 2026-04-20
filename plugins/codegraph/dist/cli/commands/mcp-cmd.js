import path from 'node:path';
import { startServer } from '../../mcp/server.js';
export function registerMcpCmd(program) {
    program
        .command('mcp')
        .description('Start the CodeGraph MCP stdio server')
        .option('--project <dir>', 'Project root directory', process.cwd())
        .action(async (options) => {
        // Guard: if --project is empty or whitespace (e.g. ${CLAUDE_PROJECT_DIR}
        // substitution failed), fall back to cwd.
        const effectiveProject = options.project?.trim() || process.cwd();
        const projectRoot = path.resolve(effectiveProject);
        try {
            await startServer(projectRoot);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`Error: ${message}`);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=mcp-cmd.js.map