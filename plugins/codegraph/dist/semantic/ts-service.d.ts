export interface IncomingCall {
    callerName: string;
    callerFile: string;
    callerLine: number;
}
export interface OutgoingCall {
    calleeName: string;
    calleeFile: string;
    calleeLine: number;
}
export interface Reference {
    file: string;
    line: number;
    isDefinition: boolean;
}
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
export declare class TSService {
    private readonly service;
    private readonly files;
    private readonly projectRoot;
    private readonly compilerOptions;
    private readonly fileNames;
    constructor(projectRoot: string);
    /**
     * Returns all functions/methods that call `symbolName` declared in `filePath`.
     *
     * `filePath` may be relative to `projectRoot` or absolute.
     */
    getIncomingCalls(filePath: string, symbolName: string): IncomingCall[];
    /**
     * Returns all functions/methods that call a method identified by a
     * qualified name such as `"ClassName.methodName"`.
     *
     * `filePath` may be relative to `projectRoot` or absolute.
     */
    getIncomingCallsByQualifiedName(filePath: string, qualifiedName: string): IncomingCall[];
    /**
     * Returns all functions/methods called by `symbolName` declared in `filePath`.
     *
     * `filePath` may be relative to `projectRoot` or absolute.
     */
    getOutgoingCalls(filePath: string, symbolName: string): OutgoingCall[];
    /**
     * Returns all locations that reference `symbolName` declared in `filePath`,
     * including the declaration itself.
     */
    findReferences(filePath: string, symbolName: string): Reference[];
    dispose(): void;
    /** Resolve a possibly-relative file path to an absolute path. */
    private resolveFilePath;
    /**
     * Walk the source file AST to find the character offset of the first
     * declaration whose name matches `symbolName`. Returns the start offset
     * of the NAME node, which is the position required by the LanguageService.
     */
    private findSymbolPosition;
    /**
     * Walk the AST to find the character offset of `methodName` within a
     * class named `className`.
     */
    private findMethodPosition;
    /**
     * Core helper: call `prepareCallHierarchy` then
     * `provideCallHierarchyIncomingCalls` and map the results.
     *
     * IMPORTANT: `provideCallHierarchyIncomingCalls` must be called with
     * `selectionSpan.start` from the prepared item, not `span.start`.
     */
    private fetchIncomingCalls;
    /**
     * Convert a character offset within a file to a 1-based line number.
     */
    private positionToLine;
    /**
     * Recursively discover all `.ts` (non-declaration) files under `dir`,
     * skipping `node_modules` and hidden directories.
     */
    private discoverTsFiles;
}
