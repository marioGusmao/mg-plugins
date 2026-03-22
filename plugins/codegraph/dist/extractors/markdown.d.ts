/**
 * Markdown Documentation Extractor
 *
 * Extracts references to known code symbols from Markdown/MDX files.
 * Does NOT use Tree-sitter — regex-based scan over plain text.
 * Skips content inside code fences to avoid false positives from code samples.
 */
export interface DocReference {
    /** The matched code symbol name. */
    symbolName: string;
    /** 1-based line number where the reference was found. */
    line: number;
    /** The full text of the line containing the reference. */
    context: string;
}
/**
 * Scan `source` for backtick references to any name in `knownSymbols`.
 *
 * Matching rules:
 * - Only inline backtick spans are considered: `name` or `name()`
 * - Content inside triple-backtick code fences is excluded
 * - Qualified names (e.g. `Foo.bar`) are matched both as-is and by their
 *   last segment (so `Foo.bar` matches the known symbol `bar`)
 * - Results are deduplicated by (symbolName, line) pair
 */
export declare function extractDocReferences(source: string, knownSymbols: Set<string>): DocReference[];
