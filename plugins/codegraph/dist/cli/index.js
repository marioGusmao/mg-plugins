#!/usr/bin/env node
import { Command } from 'commander';
import { registerIndexCmd } from './commands/index-cmd.js';
import { registerMcpCmd } from './commands/mcp-cmd.js';
import { registerQueryCmd } from './commands/query-cmd.js';
import { registerStatusCmd } from './commands/status-cmd.js';
import { registerResetCmd } from './commands/reset-cmd.js';
import { registerSetupCmd } from './commands/setup-cmd.js';
const program = new Command()
    .name('codegraph')
    .description('Code intelligence — call-chain analysis, blast radius, dependency graph queries')
    .version('1.0.0');
registerIndexCmd(program);
registerMcpCmd(program);
registerQueryCmd(program);
registerStatusCmd(program);
registerResetCmd(program);
registerSetupCmd(program);
program.parse();
//# sourceMappingURL=index.js.map