import path from 'node:path';
import { startServer } from '../../mcp/server.js';
export function registerMcpCmd(program) {
    program
        .command('mcp')
        .description('Start the CodeGraph MCP stdio server')
        .option('--project <dir>', 'Project root directory', process.cwd())
        .action(async (options) => {
        const projectRoot = path.resolve(options.project);
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