import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
// ----------------------------------------------------------------
// TSService
// ----------------------------------------------------------------
/**
 * Wraps `ts.createLanguageService()` to expose semantic call-hierarchy
 * and reference queries over a TypeScript project.
 *
 * All file paths passed to public methods may be relative to `projectRoot`.
 * Internally the service always works with absolute paths.
 *
 * Implementation notes:
 * - The compiler options are overridden to use `Bundler` module resolution
 *   so that extensionless relative imports (e.g. `import x from './math'`)
 *   are accepted without errors, which is the common pattern in TypeScript
 *   projects that do not explicitly require `.js` suffixes.
 * - `provideCallHierarchyIncomingCalls` and `provideCallHierarchyOutgoingCalls`
 *   must be called with `selectionSpan.start` (the name position), NOT
 *   `span.start` (the declaration position) from the prepared item.
 */
export class TSService {
    service;
    files;
    projectRoot;
    compilerOptions;
    fileNames;
    constructor(projectRoot) {
        this.projectRoot = path.resolve(projectRoot);
        this.files = new Map();
        // 1. Locate tsconfig.json
        const configPath = ts.findConfigFile(this.projectRoot, ts.sys.fileExists, 'tsconfig.json');
        if (!configPath) {
            throw new Error(`Cannot find tsconfig.json starting from: ${this.projectRoot}`);
        }
        // 2. Parse tsconfig
        const readResult = ts.readConfigFile(configPath, ts.sys.readFile);
        if (readResult.error) {
            throw new Error(`Error reading tsconfig: ${ts.flattenDiagnosticMessageText(readResult.error.messageText, '\n')}`);
        }
        const parsedConfig = ts.parseJsonConfigFileContent(readResult.config, ts.sys, path.dirname(configPath));
        // Override module/moduleResolution to Bundler so that extensionless
        // relative imports (e.g. `from './math'`) are resolved without errors.
        // The Language Service uses these settings only for semantic analysis —
        // not for actual compilation output — so this is safe.
        this.compilerOptions = {
            ...parsedConfig.options,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            module: ts.ModuleKind.ESNext,
        };
        // 3. Collect file names — use parsed config files, falling back to a
        //    recursive discovery of .ts files when the config has no explicit
        //    include/files entries.
        if (parsedConfig.fileNames.length > 0) {
            this.fileNames = parsedConfig.fileNames;
        }
        else {
            this.fileNames = this.discoverTsFiles(this.projectRoot);
        }
        // 4. Pre-read all source files into the snapshot cache
        for (const fileName of this.fileNames) {
            const content = ts.sys.readFile(fileName) ?? '';
            this.files.set(fileName, { version: 0, content });
        }
        // 5. Build the LanguageServiceHost
        const files = this.files;
        const compilerOptions = this.compilerOptions;
        const fileNames = this.fileNames;
        const root = this.projectRoot;
        const host = {
            getScriptFileNames: () => fileNames,
            getScriptVersion: (fileName) => String(files.get(fileName)?.version ?? 0),
            getScriptSnapshot: (fileName) => {
                const entry = files.get(fileName);
                if (entry) {
                    return ts.ScriptSnapshot.fromString(entry.content);
                }
                // Fall back to disk reads for lib files and transitive dependencies.
                const content = ts.sys.readFile(fileName);
                if (content !== undefined) {
                    return ts.ScriptSnapshot.fromString(content);
                }
                return undefined;
            },
            getCurrentDirectory: () => root,
            getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
            getCompilationSettings: () => compilerOptions,
            fileExists: (filePath) => ts.sys.fileExists(filePath),
            readFile: (filePath) => ts.sys.readFile(filePath),
            readDirectory: ts.sys.readDirectory
                ? (dirPath, extensions, exclude, include, depth) => ts.sys.readDirectory(dirPath, extensions, exclude, include, depth)
                : undefined,
        };
        // 6. Create the LanguageService
        this.service = ts.createLanguageService(host, ts.createDocumentRegistry());
    }
    // ----------------------------------------------------------------
    // Public API
    // ----------------------------------------------------------------
    /**
     * Returns all functions/methods that call `symbolName` declared in `filePath`.
     *
     * `filePath` may be relative to `projectRoot` or absolute.
     */
    getIncomingCalls(filePath, symbolName) {
        const absPath = this.resolveFilePath(filePath);
        const position = this.findSymbolPosition(absPath, symbolName);
        if (position === undefined)
            return [];
        return this.fetchIncomingCalls(absPath, position);
    }
    /**
     * Returns all functions/methods that call a method identified by a
     * qualified name such as `"ClassName.methodName"`.
     *
     * `filePath` may be relative to `projectRoot` or absolute.
     */
    getIncomingCallsByQualifiedName(filePath, qualifiedName) {
        const absPath = this.resolveFilePath(filePath);
        const dotIndex = qualifiedName.indexOf('.');
        if (dotIndex === -1) {
            return this.getIncomingCalls(filePath, qualifiedName);
        }
        const className = qualifiedName.slice(0, dotIndex);
        const methodName = qualifiedName.slice(dotIndex + 1);
        const position = this.findMethodPosition(absPath, className, methodName);
        if (position === undefined)
            return [];
        return this.fetchIncomingCalls(absPath, position);
    }
    /**
     * Returns all functions/methods called by `symbolName` declared in `filePath`.
     *
     * `filePath` may be relative to `projectRoot` or absolute.
     */
    getOutgoingCalls(filePath, symbolName) {
        const absPath = this.resolveFilePath(filePath);
        const position = this.findSymbolPosition(absPath, symbolName);
        if (position === undefined)
            return [];
        const prepared = this.service.prepareCallHierarchy(absPath, position);
        if (!prepared)
            return [];
        const items = Array.isArray(prepared) ? prepared : [prepared];
        const results = [];
        for (const item of items) {
            // IMPORTANT: use selectionSpan.start (name position), not span.start
            // (declaration start) — the Language Service requires the name offset.
            const outgoing = this.service.provideCallHierarchyOutgoingCalls(item.file, item.selectionSpan.start);
            for (const call of outgoing) {
                const callee = call.to;
                const line = this.positionToLine(callee.file, callee.selectionSpan.start);
                results.push({
                    calleeName: callee.name,
                    calleeFile: callee.file,
                    calleeLine: line,
                });
            }
        }
        return results;
    }
    /**
     * Returns all locations that reference `symbolName` declared in `filePath`,
     * including the declaration itself.
     */
    findReferences(filePath, symbolName) {
        const absPath = this.resolveFilePath(filePath);
        const position = this.findSymbolPosition(absPath, symbolName);
        if (position === undefined)
            return [];
        const refSymbols = this.service.findReferences(absPath, position);
        if (!refSymbols)
            return [];
        const results = [];
        for (const refSymbol of refSymbols) {
            for (const ref of refSymbol.references) {
                const line = this.positionToLine(ref.fileName, ref.textSpan.start);
                results.push({
                    file: ref.fileName,
                    line,
                    isDefinition: ref.isDefinition ?? false,
                });
            }
        }
        return results;
    }
    dispose() {
        this.service.dispose();
    }
    // ----------------------------------------------------------------
    // Private helpers
    // ----------------------------------------------------------------
    /** Resolve a possibly-relative file path to an absolute path. */
    resolveFilePath(filePath) {
        if (path.isAbsolute(filePath))
            return filePath;
        return path.resolve(this.projectRoot, filePath);
    }
    /**
     * Walk the source file AST to find the character offset of the first
     * declaration whose name matches `symbolName`. Returns the start offset
     * of the NAME node, which is the position required by the LanguageService.
     */
    findSymbolPosition(absPath, symbolName) {
        const content = this.files.get(absPath)?.content ?? ts.sys.readFile(absPath);
        if (!content)
            return undefined;
        const sourceFile = ts.createSourceFile(absPath, content, ts.ScriptTarget.Latest, 
        /* setParentNodes */ true);
        let found;
        const visit = (node) => {
            if (found !== undefined)
                return;
            if (ts.isFunctionDeclaration(node) && node.name?.text === symbolName) {
                found = node.name.getStart(sourceFile);
                return;
            }
            if (ts.isVariableDeclaration(node) &&
                ts.isIdentifier(node.name) &&
                node.name.text === symbolName) {
                found = node.name.getStart(sourceFile);
                return;
            }
            if (ts.isClassDeclaration(node) && node.name?.text === symbolName) {
                found = node.name.getStart(sourceFile);
                return;
            }
            if (ts.isMethodDeclaration(node) &&
                ts.isIdentifier(node.name) &&
                node.name.text === symbolName) {
                found = node.name.getStart(sourceFile);
                return;
            }
            ts.forEachChild(node, visit);
        };
        ts.forEachChild(sourceFile, visit);
        return found;
    }
    /**
     * Walk the AST to find the character offset of `methodName` within a
     * class named `className`.
     */
    findMethodPosition(absPath, className, methodName) {
        const content = this.files.get(absPath)?.content ?? ts.sys.readFile(absPath);
        if (!content)
            return undefined;
        const sourceFile = ts.createSourceFile(absPath, content, ts.ScriptTarget.Latest, 
        /* setParentNodes */ true);
        let found;
        const visitClassMembers = (classNode) => {
            for (const member of classNode.members) {
                if (ts.isMethodDeclaration(member) &&
                    ts.isIdentifier(member.name) &&
                    member.name.text === methodName) {
                    found = member.name.getStart(sourceFile);
                    return;
                }
            }
        };
        const visit = (node) => {
            if (found !== undefined)
                return;
            if ((ts.isClassDeclaration(node) || ts.isClassExpression(node)) &&
                node.name?.text === className) {
                visitClassMembers(node);
                return;
            }
            ts.forEachChild(node, visit);
        };
        ts.forEachChild(sourceFile, visit);
        return found;
    }
    /**
     * Core helper: call `prepareCallHierarchy` then
     * `provideCallHierarchyIncomingCalls` and map the results.
     *
     * IMPORTANT: `provideCallHierarchyIncomingCalls` must be called with
     * `selectionSpan.start` from the prepared item, not `span.start`.
     */
    fetchIncomingCalls(absPath, position) {
        const prepared = this.service.prepareCallHierarchy(absPath, position);
        if (!prepared)
            return [];
        const items = Array.isArray(prepared) ? prepared : [prepared];
        const results = [];
        for (const item of items) {
            const incoming = this.service.provideCallHierarchyIncomingCalls(item.file, item.selectionSpan.start);
            for (const call of incoming) {
                const caller = call.from;
                const line = this.positionToLine(caller.file, caller.selectionSpan.start);
                results.push({
                    callerName: caller.name,
                    callerFile: caller.file,
                    callerLine: line,
                });
            }
        }
        return results;
    }
    /**
     * Convert a character offset within a file to a 1-based line number.
     */
    positionToLine(absPath, position) {
        const content = this.files.get(absPath)?.content ?? ts.sys.readFile(absPath) ?? '';
        return content.slice(0, position).split('\n').length;
    }
    /**
     * Recursively discover all `.ts` (non-declaration) files under `dir`,
     * skipping `node_modules` and hidden directories.
     */
    discoverTsFiles(dir) {
        const results = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === 'node_modules' || entry.name.startsWith('.'))
                continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(...this.discoverTsFiles(fullPath));
            }
            else if (entry.isFile() &&
                (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
                !entry.name.endsWith('.d.ts') &&
                !entry.name.endsWith('.d.tsx')) {
                results.push(fullPath);
            }
        }
        return results;
    }
}
//# sourceMappingURL=ts-service.js.map