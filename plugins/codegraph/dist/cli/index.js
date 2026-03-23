#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { registerIndexCmd } from './commands/index-cmd.js';
import { registerMcpCmd } from './commands/mcp-cmd.js';
import { registerQueryCmd } from './commands/query-cmd.js';
import { registerStatusCmd } from './commands/status-cmd.js';
import { registerResetCmd } from './commands/reset-cmd.js';
import { registerSetupCmd } from './commands/setup-cmd.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgJsonPath = path.resolve(__dirname, '..', '..', 'package.json');
const pkgVersion = (() => {
    try {
        return JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).version;
    }
    catch {
        return '0.0.0';
    }
})();
const program = new Command()
    .name('codegraph')
    .description('Code intelligence — call-chain analysis, blast radius, dependency graph queries')
    .version(pkgVersion);
registerIndexCmd(program);
registerMcpCmd(program);
registerQueryCmd(program);
registerStatusCmd(program);
registerResetCmd(program);
registerSetupCmd(program);
program.parse();
//# sourceMappingURL=index.js.map