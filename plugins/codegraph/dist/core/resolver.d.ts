/**
 * Resolves import specifiers to file paths relative to projectRoot.
 * Handles relative imports, tsconfig path aliases, and workspace package names.
 */
export declare class Resolver {
    private readonly projectRoot;
    private readonly tsPaths;
    private readonly workspacePackages;
    constructor(projectRoot: string);
    /**
     * Resolves an import specifier to a file path relative to projectRoot.
     * Returns null if the import is a node_module, built-in, or unresolvable.
     */
    resolveImportPath(importSource: string, importerFilePath: string): string | null;
    /**
     * Follows `export { X } from './Y'` re-export chains up to `depth` levels
     * to find the file where the symbol is originally defined.
     * Returns a path relative to projectRoot, or null if the chain cannot be followed.
     */
    resolveExportChain(symbolName: string, filePath: string, depth?: number): string | null;
    private resolveRelative;
    private resolveTsConfigPath;
    private resolveWorkspacePackage;
    /**
     * Recursively follows re-export chains.
     * Parses `export { X } from './Y'` and `export * from './Y'` statements.
     */
    private followExportChain;
    /**
     * Tries a base path with common TypeScript/JavaScript extensions.
     * Returns the first existing absolute file path, or null.
     */
    private tryExtensions;
    private loadTsConfigPaths;
    private loadWorkspacePackages;
    /**
     * Expands workspace glob patterns (e.g. "packages/*") into a
     * package-name -> relative-root map by reading each matching directory's package.json.
     */
    private expandWorkspaceGlobs;
    private toProjectRelative;
    private normalizePath;
}
