/**
 * Markdown Documentation Extractor
 *
 * Extracts references to known code symbols from Markdown/MDX files.
 * Does NOT use Tree-sitter — regex-based scan over plain text.
 * Skips content inside code fences to avoid false positives from code samples.
 */
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
export function extractDocReferences(source, knownSymbols) {
    const refs = [];
    const lines = source.split('\n');
    let inCodeFence = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Track opening/closing of triple-backtick fences.
        // A fence line starts with optional whitespace then ```.
        if (line.trimStart().startsWith('```') || line.trimStart().startsWith('~~~')) {
            inCodeFence = !inCodeFence;
            continue;
        }
        if (inCodeFence)
            continue;
        // Match inline backtick spans: `identifierOrQualified` or `identifier()`
        // Pattern breakdown:
        //   `                           — opening backtick
        //   ([a-zA-Z_$][\w$]*(?:\.\w+)*)  — identifier, optionally dotted
        //   \(?\)?                      — optional trailing parentheses
        //   `                           — closing backtick
        const backtickPattern = /`([a-zA-Z_$][\w$]*(?:\.\w+)*)\(?\)?`/g;
        let match;
        while ((match = backtickPattern.exec(line)) !== null) {
            const name = match[1];
            const lineNumber = i + 1;
            const context = line.trim();
            // Direct match against known symbols
            if (knownSymbols.has(name)) {
                refs.push({ symbolName: name, line: lineNumber, context });
            }
            // Also resolve the last segment of a qualified name (e.g. "Foo.bar" → "bar")
            const parts = name.split('.');
            if (parts.length > 1) {
                const lastPart = parts[parts.length - 1];
                if (knownSymbols.has(lastPart)) {
                    refs.push({ symbolName: lastPart, line: lineNumber, context });
                }
            }
        }
    }
    // Deduplicate by (symbolName, line) — a symbol may appear multiple times on
    // the same line (e.g. `add` and `add()`) and should only be reported once.
    const seen = new Set();
    return refs.filter(r => {
        const key = `${r.symbolName}:${r.line}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
//# sourceMappingURL=markdown.js.map