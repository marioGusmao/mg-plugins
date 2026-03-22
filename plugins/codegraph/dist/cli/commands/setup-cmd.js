import fs from 'node:fs';
import path from 'node:path';
export function registerSetupCmd(program) {
    program
        .command('setup')
        .description('Configure CodeGraph for AI tools (Codex CLI, Cursor, Windsurf)')
        .option('--project <dir>', 'Project directory', process.cwd())
        .option('--codex', 'Configure for Codex CLI (.mcp.json + AGENTS.md)')
        .option('--cursor', 'Configure for Cursor (.cursor/mcp.json)')
        .option('--windsurf', 'Configure for Windsurf (.windsurf/mcp.json)')
        .option('--all', 'Configure for all detected tools')
        .action((options) => {
        const projectDir = path.resolve(options.project);
        const targets = [];
        if (options.all) {
            // Auto-detect
            if (fs.existsSync(path.join(projectDir, '.codex')) || fs.existsSync(path.join(projectDir, 'AGENTS.md'))) {
                targets.push('codex');
            }
            if (fs.existsSync(path.join(projectDir, '.cursor'))) {
                targets.push('cursor');
            }
            if (fs.existsSync(path.join(projectDir, '.windsurf'))) {
                targets.push('windsurf');
            }
            if (targets.length === 0) {
                // Default to codex since it's the most common
                targets.push('codex');
            }
        }
        else {
            if (options.codex)
                targets.push('codex');
            if (options.cursor)
                targets.push('cursor');
            if (options.windsurf)
                targets.push('windsurf');
        }
        if (targets.length === 0) {
            console.log('No target specified. Use --codex, --cursor, --windsurf, or --all.');
            console.log('For Claude Code, use: claude plugin add <path-or-url>');
            process.exit(1);
        }
        for (const target of targets) {
            switch (target) {
                case 'codex':
                    setupCodex(projectDir);
                    break;
                case 'cursor':
                    setupMcpConfig(projectDir, '.cursor/mcp.json');
                    break;
                case 'windsurf':
                    setupMcpConfig(projectDir, '.windsurf/mcp.json');
                    break;
            }
        }
        console.log('\nSetup complete. Now index the project:');
        console.log(`  codegraph index --project "${projectDir}"`);
    });
}
function setupCodex(projectDir) {
    // 1. Write .mcp.json
    setupMcpConfig(projectDir, '.mcp.json');
    // 2. Append CodeGraph section to AGENTS.md
    const agentsPath = path.join(projectDir, 'AGENTS.md');
    const marker = '<!-- codegraph-start -->';
    const section = `
${marker}
## CodeGraph — Code Intelligence Tools

Before refactoring, renaming, or changing function signatures, use the CodeGraph MCP tools to understand impact:

- \`codegraph_blast\` — **blast radius**: callers + callees + affected files for a symbol
- \`codegraph_callers\` — who calls this function? (recursive)
- \`codegraph_callees\` — what does this function call? (recursive)
- \`codegraph_depends\` — file-level dependency tree (in/out/both)
- \`codegraph_search\` — find symbols by name substring
- \`codegraph_status\` — index health and stale file count

### Disambiguation
When multiple symbols share a name, provide \`file\` or \`qualified_name\` (e.g., \`Foo.render\`) to disambiguate.

### Keeping the Index Fresh
Run \`codegraph index --incremental\` after pulling changes or making edits. Takes <200ms for a few files.
<!-- codegraph-end -->
`;
    if (fs.existsSync(agentsPath)) {
        const content = fs.readFileSync(agentsPath, 'utf-8');
        if (content.includes(marker)) {
            console.log('  AGENTS.md already has CodeGraph section — skipping');
        }
        else {
            fs.appendFileSync(agentsPath, section);
            console.log('  AGENTS.md — appended CodeGraph section');
        }
    }
    else {
        fs.writeFileSync(agentsPath, `# Agent Instructions\n${section}`);
        console.log('  AGENTS.md — created with CodeGraph section');
    }
}
function setupMcpConfig(projectDir, relPath) {
    const configPath = path.join(projectDir, relPath);
    const configDir = path.dirname(configPath);
    const mcpEntry = {
        codegraph: {
            type: 'stdio',
            command: 'npx',
            args: ['codegraph', 'mcp'],
        },
    };
    if (fs.existsSync(configPath)) {
        try {
            const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (existing.codegraph || existing.mcpServers?.codegraph) {
                console.log(`  ${relPath} — CodeGraph already configured — skipping`);
                return;
            }
            // Merge into existing config
            if (existing.mcpServers) {
                existing.mcpServers.codegraph = mcpEntry.codegraph;
            }
            else {
                Object.assign(existing, mcpEntry);
            }
            fs.writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n');
            console.log(`  ${relPath} — added CodeGraph MCP server`);
        }
        catch {
            console.log(`  ${relPath} — could not parse existing file, skipping`);
        }
    }
    else {
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(mcpEntry, null, 2) + '\n');
        console.log(`  ${relPath} — created with CodeGraph MCP server`);
    }
}
//# sourceMappingURL=setup-cmd.js.map