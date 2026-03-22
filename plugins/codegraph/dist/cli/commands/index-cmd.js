import fs from 'node:fs';
import path from 'node:path';
import { Indexer } from '../../core/indexer.js';
export function registerIndexCmd(program) {
    program
        .command('index')
        .description('Index a project directory and build the CodeGraph database')
        .option('--project <dir>', 'Project root directory', process.cwd())
        .option('--incremental', 'Only re-index changed files', false)
        .action((options) => {
        const projectRoot = path.resolve(options.project);
        const incremental = options.incremental;
        console.log(`Indexing ${projectRoot}${incremental ? ' (incremental)' : ''}…`);
        try {
            const indexer = new Indexer(projectRoot);
            const stats = indexer.index({ incremental });
            console.log('');
            console.log('Index complete:');
            console.log(`  Files processed : ${stats.filesProcessed}`);
            console.log(`  Symbols found   : ${stats.symbolsFound}`);
            console.log(`  Syntactic edges : ${stats.syntacticEdges}`);
            console.log(`  Semantic edges  : ${stats.semanticEdges}`);
            console.log(`  Docs processed  : ${stats.docsProcessed}`);
            console.log(`  Doc references  : ${stats.referencesFound}`);
            // Auto-add .codegraph/ to .gitignore if not already there
            ensureGitignore(projectRoot);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`Error: ${message}`);
            process.exit(1);
        }
    });
}
function ensureGitignore(projectRoot) {
    const gitignorePath = path.join(projectRoot, '.gitignore');
    const entry = '.codegraph/';
    try {
        if (fs.existsSync(gitignorePath)) {
            const content = fs.readFileSync(gitignorePath, 'utf-8');
            if (content.includes(entry))
                return; // Already there
            fs.appendFileSync(gitignorePath, `\n# CodeGraph index (local cache, regenerate with: codegraph index)\n${entry}\n`);
            console.log('\n  Added .codegraph/ to .gitignore');
        }
        else {
            // Create .gitignore if the project looks like a real project (has package.json, tsconfig, or .git)
            const isProject = fs.existsSync(path.join(projectRoot, '.git')) ||
                fs.existsSync(path.join(projectRoot, 'package.json')) ||
                fs.existsSync(path.join(projectRoot, 'tsconfig.json'));
            if (isProject) {
                fs.writeFileSync(gitignorePath, `# CodeGraph index (local cache, regenerate with: codegraph index)\n${entry}\n`);
                console.log('\n  Added .codegraph/ to .gitignore');
            }
        }
    }
    catch {
        // Non-critical — don't fail indexing because of gitignore
    }
}
//# sourceMappingURL=index-cmd.js.map