import fs from 'node:fs';
import path from 'node:path';
// Node.js built-in module names (without node: prefix).
// This list is used to detect bare built-in specifiers like 'fs', 'path', etc.
const NODE_BUILTINS = new Set([
    'assert', 'async_hooks', 'buffer',
    // process management
    'child_process', 'cluster',
    'console', 'constants', 'crypto',
    'dgram', 'diagnostics_channel', 'dns', 'domain',
    'events', 'fs', 'http', 'http2', 'https',
    'inspector', 'module', 'net', 'os', 'path',
    'perf_hooks', 'process', 'punycode', 'querystring',
    'readline', 'repl', 'stream', 'string_decoder', 'sys',
    'timers', 'tls', 'trace_events', 'tty', 'url', 'util',
    'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
]);
/**
 * Resolves import specifiers to file paths relative to projectRoot.
 * Handles relative imports, tsconfig path aliases, and workspace package names.
 */
export class Resolver {
    projectRoot;
    tsPaths;
    workspacePackages;
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.tsPaths = this.loadTsConfigPaths();
        this.workspacePackages = this.loadWorkspacePackages();
    }
    /**
     * Resolves an import specifier to a file path relative to projectRoot.
     * Returns null if the import is a node_module, built-in, or unresolvable.
     */
    resolveImportPath(importSource, importerFilePath) {
        // Skip Node.js built-ins (node:fs, node:path, etc.)
        if (importSource.startsWith('node:')) {
            return null;
        }
        if (NODE_BUILTINS.has(importSource)) {
            return null;
        }
        // 1. Relative imports
        if (importSource.startsWith('.')) {
            return this.resolveRelative(importSource, importerFilePath);
        }
        // 2. tsconfig path aliases
        const fromPaths = this.resolveTsConfigPath(importSource);
        if (fromPaths !== null) {
            return fromPaths;
        }
        // 3. Workspace package names
        const fromWorkspace = this.resolveWorkspacePackage(importSource);
        if (fromWorkspace !== null) {
            return fromWorkspace;
        }
        // 4. Everything else (bare node_modules specifiers) — skip
        return null;
    }
    /**
     * Follows `export { X } from './Y'` re-export chains up to `depth` levels
     * to find the file where the symbol is originally defined.
     * Returns a path relative to projectRoot, or null if the chain cannot be followed.
     */
    resolveExportChain(symbolName, filePath, depth = 5) {
        const absFilePath = path.isAbsolute(filePath)
            ? filePath
            : path.join(this.projectRoot, filePath);
        return this.followExportChain(symbolName, absFilePath, depth);
    }
    // ── Private helpers ────────────────────────────────────────────────────────
    resolveRelative(importSource, importerFilePath) {
        const importerDir = path.dirname(importerFilePath);
        const candidateBase = path.resolve(importerDir, importSource);
        const resolved = this.tryExtensions(candidateBase);
        if (resolved === null)
            return null;
        return path.relative(this.projectRoot, resolved);
    }
    resolveTsConfigPath(importSource) {
        const { baseUrl, paths } = this.tsPaths;
        if (!baseUrl)
            return null;
        for (const [pattern, replacements] of Object.entries(paths)) {
            const matched = matchGlob(pattern, importSource);
            if (matched === null)
                continue;
            for (const replacement of replacements) {
                const expandedReplacement = replacement.includes('*')
                    ? replacement.replace('*', matched)
                    : replacement;
                const candidateBase = path.join(this.projectRoot, baseUrl, expandedReplacement);
                const resolved = this.tryExtensions(candidateBase);
                if (resolved !== null) {
                    return path.relative(this.projectRoot, resolved);
                }
            }
        }
        return null;
    }
    resolveWorkspacePackage(importSource) {
        const pkgRoot = this.workspacePackages.get(importSource);
        if (!pkgRoot)
            return null;
        const absPkgRoot = path.join(this.projectRoot, pkgRoot);
        // Check the package's own package.json for a "main" entry
        const pkgJsonPath = path.join(absPkgRoot, 'package.json');
        if (fs.existsSync(pkgJsonPath)) {
            try {
                const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
                const mainField = pkgJson['main'] ?? pkgJson['module'];
                if (typeof mainField === 'string') {
                    const mainAbs = path.join(absPkgRoot, mainField);
                    const resolved = this.tryExtensions(mainAbs);
                    if (resolved !== null) {
                        return path.relative(this.projectRoot, resolved);
                    }
                }
            }
            catch {
                // Malformed package.json — fall through
            }
        }
        // Fall back: look for src/index.ts or index.ts
        const candidates = [
            path.join(absPkgRoot, 'src', 'index'),
            path.join(absPkgRoot, 'index'),
        ];
        for (const candidate of candidates) {
            const resolved = this.tryExtensions(candidate);
            if (resolved !== null) {
                return path.relative(this.projectRoot, resolved);
            }
        }
        return null;
    }
    /**
     * Recursively follows re-export chains.
     * Parses `export { X } from './Y'` and `export * from './Y'` statements.
     */
    followExportChain(symbolName, absFilePath, remainingDepth) {
        if (remainingDepth <= 0)
            return null;
        if (!fs.existsSync(absFilePath))
            return null;
        let source;
        try {
            source = fs.readFileSync(absFilePath, 'utf8');
        }
        catch {
            return null;
        }
        // Match: export { foo, bar as baz } from './module'
        const namedReExportPattern = /export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = namedReExportPattern.exec(source)) !== null) {
            const exportList = match[1];
            const fromSource = match[2];
            const bindings = exportList.split(',').map((s) => s.trim()).filter(Boolean);
            for (const binding of bindings) {
                // binding may be "foo" or "foo as bar"
                const parts = binding.split(/\s+as\s+/);
                const localName = parts[0].trim();
                const exportedName = (parts[1] ?? parts[0]).trim();
                if (exportedName === symbolName || localName === symbolName) {
                    const relativePath = this.resolveImportPath(fromSource, absFilePath);
                    const nextFile = relativePath ? path.join(this.projectRoot, relativePath) : null;
                    if (nextFile === null)
                        return null;
                    let nextSource = '';
                    if (fs.existsSync(nextFile)) {
                        try {
                            nextSource = fs.readFileSync(nextFile, 'utf8');
                        }
                        catch {
                            nextSource = '';
                        }
                    }
                    if (isSymbolDefined(localName, nextSource)) {
                        return path.relative(this.projectRoot, nextFile);
                    }
                    // Not defined directly — recurse
                    const deeper = this.followExportChain(localName, nextFile, remainingDepth - 1);
                    if (deeper !== null)
                        return deeper;
                }
            }
        }
        // Match: export * from './module'
        const starReExportPattern = /export\s*\*\s*(?:as\s+\w+\s+)?from\s*['"]([^'"]+)['"]/g;
        while ((match = starReExportPattern.exec(source)) !== null) {
            const fromSource = match[1];
            const relativePath = this.resolveImportPath(fromSource, absFilePath);
            const nextFile = relativePath ? path.join(this.projectRoot, relativePath) : null;
            if (nextFile === null)
                continue;
            const deeper = this.followExportChain(symbolName, nextFile, remainingDepth - 1);
            if (deeper !== null)
                return deeper;
        }
        return null;
    }
    /**
     * Tries a base path with common TypeScript/JavaScript extensions.
     * Returns the first existing absolute file path, or null.
     */
    tryExtensions(base) {
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];
        if (fs.existsSync(base) && fs.statSync(base).isFile()) {
            return base;
        }
        for (const ext of extensions) {
            const candidate = base + ext;
            if (fs.existsSync(candidate))
                return candidate;
        }
        for (const ext of extensions) {
            const candidate = path.join(base, `index${ext}`);
            if (fs.existsSync(candidate))
                return candidate;
        }
        return null;
    }
    // ── Config loaders ─────────────────────────────────────────────────────────
    loadTsConfigPaths() {
        const result = { baseUrl: '', paths: {} };
        const tsConfigPath = path.join(this.projectRoot, 'tsconfig.json');
        if (!fs.existsSync(tsConfigPath))
            return result;
        try {
            const loaded = this.readTsConfig(tsConfigPath, new Set());
            if (loaded.compilerOptions?.baseUrl) {
                result.baseUrl = loaded.compilerOptions.baseUrl;
            }
            if (loaded.compilerOptions?.paths) {
                result.paths = loaded.compilerOptions.paths;
            }
        }
        catch {
            // Malformed tsconfig — return empty
        }
        return result;
    }
    /**
     * Reads a tsconfig.json, resolving `extends` chains recursively.
     * Child compilerOptions override parent.
     */
    readTsConfig(tsConfigPath, visited) {
        const abs = path.resolve(tsConfigPath);
        if (visited.has(abs))
            return {};
        visited.add(abs);
        if (!fs.existsSync(abs))
            return {};
        let raw;
        try {
            raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
        }
        catch {
            return {};
        }
        const dir = path.dirname(abs);
        let parentOptions = {};
        if (raw.extends) {
            const extendsArray = Array.isArray(raw.extends) ? raw.extends : [raw.extends];
            for (const ext of extendsArray) {
                const extPath = path.resolve(dir, ext.endsWith('.json') ? ext : `${ext}.json`);
                const parent = this.readTsConfig(extPath, visited);
                parentOptions = { ...parentOptions, ...(parent.compilerOptions ?? {}) };
            }
        }
        return {
            compilerOptions: { ...parentOptions, ...(raw.compilerOptions ?? {}) },
        };
    }
    loadWorkspacePackages() {
        const map = new Map();
        const pkgJsonPath = path.join(this.projectRoot, 'package.json');
        if (fs.existsSync(pkgJsonPath)) {
            try {
                const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
                const workspaces = pkgJson['workspaces'];
                const patterns = Array.isArray(workspaces) ? workspaces : [];
                this.expandWorkspaceGlobs(patterns, map);
            }
            catch {
                // Malformed package.json — skip
            }
        }
        const pnpmWorkspacePath = path.join(this.projectRoot, 'pnpm-workspace.yaml');
        if (fs.existsSync(pnpmWorkspacePath)) {
            try {
                const content = fs.readFileSync(pnpmWorkspacePath, 'utf8');
                const patterns = parsePnpmWorkspaceYaml(content);
                this.expandWorkspaceGlobs(patterns, map);
            }
            catch {
                // Malformed YAML — skip
            }
        }
        return map;
    }
    /**
     * Expands workspace glob patterns (e.g. "packages/*") into a
     * package-name -> relative-root map by reading each matching directory's package.json.
     */
    expandWorkspaceGlobs(patterns, map) {
        for (const pattern of patterns) {
            const segments = pattern.split('/');
            const lastSegment = segments[segments.length - 1];
            if (lastSegment === '*') {
                // Single-level wildcard: enumerate the parent directory
                const parentDir = path.join(this.projectRoot, ...segments.slice(0, -1));
                if (!fs.existsSync(parentDir))
                    continue;
                let entries;
                try {
                    entries = fs.readdirSync(parentDir);
                }
                catch {
                    continue;
                }
                for (const entry of entries) {
                    const entryPath = path.join(parentDir, entry);
                    try {
                        if (!fs.statSync(entryPath).isDirectory())
                            continue;
                    }
                    catch {
                        continue;
                    }
                    const entryPkgJson = path.join(entryPath, 'package.json');
                    if (!fs.existsSync(entryPkgJson))
                        continue;
                    try {
                        const entryPkg = JSON.parse(fs.readFileSync(entryPkgJson, 'utf8'));
                        const name = entryPkg['name'];
                        if (typeof name === 'string' && name) {
                            map.set(name, path.relative(this.projectRoot, entryPath));
                        }
                    }
                    catch {
                        // Malformed — skip
                    }
                }
            }
            else {
                // Literal path (no wildcard)
                const dirPath = path.join(this.projectRoot, pattern);
                if (!fs.existsSync(dirPath))
                    continue;
                const entryPkgJson = path.join(dirPath, 'package.json');
                if (!fs.existsSync(entryPkgJson))
                    continue;
                try {
                    const entryPkg = JSON.parse(fs.readFileSync(entryPkgJson, 'utf8'));
                    const name = entryPkg['name'];
                    if (typeof name === 'string' && name) {
                        map.set(name, path.relative(this.projectRoot, dirPath));
                    }
                }
                catch {
                    // Malformed — skip
                }
            }
        }
    }
}
// ── Module-level helpers ─────────────────────────────────────────────────────
/**
 * Matches an import specifier against a tsconfig paths pattern.
 * Returns the matched wildcard segment if matched, '' for exact matches, null if no match.
 *
 * Examples:
 *   matchGlob('@shared/*', '@shared/utils') => 'utils'
 *   matchGlob('@app', '@app')              => ''
 *   matchGlob('@shared/*', 'lodash')       => null
 */
function matchGlob(pattern, importSource) {
    const wildcardIndex = pattern.indexOf('*');
    if (wildcardIndex === -1) {
        return pattern === importSource ? '' : null;
    }
    const prefix = pattern.slice(0, wildcardIndex);
    const suffix = pattern.slice(wildcardIndex + 1);
    if (!importSource.startsWith(prefix))
        return null;
    if (suffix && !importSource.endsWith(suffix))
        return null;
    const matchedSegment = importSource.slice(prefix.length, suffix ? importSource.length - suffix.length : importSource.length);
    return matchedSegment;
}
/**
 * Checks whether a symbol is directly defined (not just re-exported) in the
 * given source text.
 */
function isSymbolDefined(symbolName, source) {
    const escaped = symbolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
        new RegExp(`\\bexport\\s+(?:async\\s+)?function\\s+${escaped}\\b`),
        new RegExp(`\\bexport\\s+(?:abstract\\s+)?class\\s+${escaped}\\b`),
        new RegExp(`\\bexport\\s+(?:const|let|var)\\s+${escaped}\\b`),
        new RegExp(`\\bexport\\s+(?:type|interface)\\s+${escaped}\\b`),
        new RegExp(`\\b(?:const|let|var|function|class)\\s+${escaped}\\b`),
    ];
    return patterns.some((p) => p.test(source));
}
/**
 * Minimal YAML parser for pnpm-workspace.yaml.
 * Only handles the "packages:" list format.
 */
function parsePnpmWorkspaceYaml(content) {
    const result = [];
    let inPackages = false;
    for (const rawLine of content.split('\n')) {
        const line = rawLine.trimEnd();
        if (/^packages\s*:/.test(line)) {
            inPackages = true;
            continue;
        }
        if (inPackages) {
            if (line.length > 0 && !/^\s/.test(line)) {
                inPackages = false;
                continue;
            }
            const itemMatch = /^\s+-\s+['"]?([^'"]+)['"]?/.exec(line);
            if (itemMatch) {
                result.push(itemMatch[1].trim());
            }
        }
    }
    return result;
}
//# sourceMappingURL=resolver.js.map