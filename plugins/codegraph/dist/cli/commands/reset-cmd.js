import path from 'node:path';
import fs from 'node:fs';
import { Indexer } from '../../core/indexer.js';
export function registerResetCmd(program) {
    program
        .command('reset')
        .description('Delete the .codegraph/ directory and rebuild the index from scratch')
        .option('--project <dir>', 'Project root directory', process.cwd())
        .action((options) => {
        const projectRoot = path.resolve(options.project);
        const codegraphDir = path.join(projectRoot, '.codegraph');
        // Delete existing index directory
        if (fs.existsSync(codegraphDir)) {
            console.log(`Removing ${codegraphDir}…`);
            fs.rmSync(codegraphDir, { recursive: true, force: true });
        }
        else {
            console.log('No existing index found — building fresh.');
        }
        // Run full index
        console.log(`Indexing ${projectRoot}…`);
        const indexer = new Indexer(projectRoot);
        try {
            const stats = indexer.index({ incremental: false });
            console.log('');
            console.log('Index complete:');
            console.log(`  Files processed : ${stats.filesProcessed}`);
            console.log(`  Symbols found   : ${stats.symbolsFound}`);
            console.log(`  Syntactic edges : ${stats.syntacticEdges}`);
            console.log(`  Semantic edges  : ${stats.semanticEdges}`);
            console.log(`  Docs processed  : ${stats.docsProcessed}`);
            console.log(`  Doc references  : ${stats.referencesFound}`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`Error: ${message}`);
            process.exit(1);
        }
        finally {
            indexer.close();
        }
    });
}
//# sourceMappingURL=reset-cmd.js.map