import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Database } from '../../core/db.js';
import { formatStatus } from '../../core/formatter.js';
export function registerStatusCmd(program) {
    program
        .command('status')
        .description('Show the current state of the CodeGraph index')
        .option('--project <dir>', 'Project root directory', process.cwd())
        .option('--check-file <path>', 'Check if a specific file is stale in the index (outputs "stale" or "current")')
        .action((options) => {
        const projectRoot = path.resolve(options.project);
        const dbPath = path.join(projectRoot, '.codegraph', 'graph.db');
        if (!fs.existsSync(dbPath)) {
            console.error('No CodeGraph index found. Run `codegraph index` in your project directory to create one.');
            process.exit(1);
        }
        const db = new Database(projectRoot);
        try {
            if (options.checkFile) {
                checkFileStaleness(db, projectRoot, options.checkFile);
            }
            else {
                const status = db.getStatus(projectRoot);
                console.log(formatStatus(status));
            }
        }
        finally {
            db.close();
        }
    });
}
// ---------------------------------------------------------------------------
// Staleness check
// ---------------------------------------------------------------------------
function checkFileStaleness(db, projectRoot, filePath) {
    // Resolve to absolute path first, then compute relative path to the project root
    const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    const relPath = path.relative(projectRoot, absPath);
    // Compute current SHA-256 of the file
    let currentHash = null;
    try {
        const content = fs.readFileSync(absPath);
        currentHash = createHash('sha256').update(content).digest('hex');
    }
    catch {
        // File does not exist or cannot be read — treat as stale
        console.log('stale');
        return;
    }
    // Look up stored hash in DB
    const record = db.getFileByPath(relPath);
    if (!record) {
        // File is not indexed — stale
        console.log('stale');
        return;
    }
    if (record.hash !== currentHash) {
        console.log('stale');
    }
    else {
        console.log('current');
    }
}
//# sourceMappingURL=status-cmd.js.map