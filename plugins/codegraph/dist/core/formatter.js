// ---------------------------------------------------------------------------
// formatCallers
// ---------------------------------------------------------------------------
/**
 * Format caller results as Markdown with depth grouping and an impact summary.
 */
export function formatCallers(symbolName, filePath, line, results) {
    const lines = [];
    lines.push(`## Callers of \`${symbolName}\``);
    lines.push(`> Defined in \`${filePath}\` at line ${line}`);
    lines.push('');
    if (results.length === 0) {
        lines.push('_No callers found._');
        return lines.join('\n');
    }
    // Group by depth
    const byDepth = new Map();
    for (const r of results) {
        const group = byDepth.get(r.depth) ?? [];
        group.push(r);
        byDepth.set(r.depth, group);
    }
    const sortedDepths = Array.from(byDepth.keys()).sort((a, b) => a - b);
    for (const depth of sortedDepths) {
        const label = depth === 1 ? 'Direct (depth 1)' : `Indirect (depth ${depth})`;
        lines.push(`### ${label}`);
        lines.push('');
        for (const r of byDepth.get(depth)) {
            lines.push(`- \`${r.symbolName}\` — \`${r.filePath}\`:${r.lineStart}`);
        }
        lines.push('');
    }
    // Impact summary
    const fileSet = new Set(results.map(r => r.filePath));
    lines.push('### Impact summary');
    lines.push('');
    lines.push(`${results.length} symbols across ${fileSet.size} files`);
    return lines.join('\n');
}
// ---------------------------------------------------------------------------
// formatCallees
// ---------------------------------------------------------------------------
/**
 * Format callee results as Markdown with depth grouping.
 */
export function formatCallees(symbolName, filePath, line, results) {
    const lines = [];
    lines.push(`## Callees of \`${symbolName}\``);
    lines.push(`> Defined in \`${filePath}\` at line ${line}`);
    lines.push('');
    if (results.length === 0) {
        lines.push('_No callees found._');
        return lines.join('\n');
    }
    const byDepth = new Map();
    for (const r of results) {
        const group = byDepth.get(r.depth) ?? [];
        group.push(r);
        byDepth.set(r.depth, group);
    }
    const sortedDepths = Array.from(byDepth.keys()).sort((a, b) => a - b);
    for (const depth of sortedDepths) {
        const label = depth === 1 ? 'Direct (depth 1)' : `Indirect (depth ${depth})`;
        lines.push(`### ${label}`);
        lines.push('');
        for (const r of byDepth.get(depth)) {
            lines.push(`- \`${r.symbolName}\` — \`${r.filePath}\`:${r.lineStart}`);
        }
        lines.push('');
    }
    const fileSet = new Set(results.map(r => r.filePath));
    lines.push('### Impact summary');
    lines.push('');
    lines.push(`${results.length} symbols across ${fileSet.size} files`);
    return lines.join('\n');
}
// ---------------------------------------------------------------------------
// formatBlast
// ---------------------------------------------------------------------------
/**
 * Format blast-radius results as Markdown.
 */
export function formatBlast(symbolName, callers, callees, affectedFiles, docReferences = []) {
    const lines = [];
    lines.push(`## Blast radius for \`${symbolName}\``);
    lines.push('');
    lines.push(`### Callers (${callers.length})`);
    lines.push('');
    if (callers.length === 0) {
        lines.push('_None_');
    }
    else {
        for (const r of callers) {
            lines.push(`- \`${r.symbolName}\` — \`${r.filePath}\`:${r.lineStart} (depth ${r.depth})`);
        }
    }
    lines.push('');
    lines.push(`### Callees (${callees.length})`);
    lines.push('');
    if (callees.length === 0) {
        lines.push('_None_');
    }
    else {
        for (const r of callees) {
            lines.push(`- \`${r.symbolName}\` — \`${r.filePath}\`:${r.lineStart} (depth ${r.depth})`);
        }
    }
    lines.push('');
    lines.push(`### Affected files (${affectedFiles.length})`);
    lines.push('');
    for (const f of affectedFiles) {
        lines.push(`- \`${f}\``);
    }
    if (docReferences.length > 0) {
        lines.push('');
        lines.push(formatDocReferences(docReferences));
    }
    return lines.join('\n');
}
// ---------------------------------------------------------------------------
// formatDocReferences
// ---------------------------------------------------------------------------
/**
 * Format documentation references as a Markdown section.
 */
export function formatDocReferences(refs) {
    const lines = [];
    lines.push(`### Documentation referencing this symbol (${refs.length})`);
    for (const ref of refs) {
        const contextSuffix = ref.context ? ` — "${ref.context}"` : '';
        lines.push(`- \`${ref.docFile}\`:${ref.line}${contextSuffix}`);
    }
    return lines.join('\n');
}
// ---------------------------------------------------------------------------
// formatDepends
// ---------------------------------------------------------------------------
/**
 * Format file dependency results as Markdown.
 */
export function formatDepends(file, results) {
    const lines = [];
    lines.push(`## File dependencies for \`${file}\``);
    lines.push('');
    const inbound = results.filter(r => r.direction === 'in');
    const outbound = results.filter(r => r.direction === 'out');
    lines.push(`### Inbound (${inbound.length})`);
    lines.push('');
    if (inbound.length === 0) {
        lines.push('_None_');
    }
    else {
        for (const r of inbound) {
            lines.push(`- \`${r.filePath}\` (${r.kind})`);
        }
    }
    lines.push('');
    lines.push(`### Outbound (${outbound.length})`);
    lines.push('');
    if (outbound.length === 0) {
        lines.push('_None_');
    }
    else {
        for (const r of outbound) {
            lines.push(`- \`${r.filePath}\` (${r.kind})`);
        }
    }
    return lines.join('\n');
}
// ---------------------------------------------------------------------------
// formatSearch
// ---------------------------------------------------------------------------
/**
 * Format symbol search results as Markdown.
 */
export function formatSearch(query, results) {
    const lines = [];
    lines.push(`## Search results for \`${query}\``);
    lines.push('');
    if (results.length === 0) {
        lines.push('_No symbols found._');
        return lines.join('\n');
    }
    for (const r of results) {
        lines.push(`- \`${r.symbolName}\` (${r.kind}) — \`${r.filePath}\`:${r.lineStart}`);
        if (r.qualifiedName !== r.symbolName) {
            lines.push(`  _Qualified: \`${r.qualifiedName}\`_`);
        }
    }
    return lines.join('\n');
}
// ---------------------------------------------------------------------------
// formatDisambiguation
// ---------------------------------------------------------------------------
/**
 * Format a disambiguation listing as Markdown.
 */
export function formatDisambiguation(name, matches) {
    const lines = [];
    lines.push(`## Multiple symbols found for \`${name}\``);
    lines.push('');
    lines.push(`Found ${matches.length} symbols with this name. Re-query with \`file\` parameter to narrow down:`);
    lines.push('');
    for (const m of matches) {
        lines.push(`- \`${m.name}\` (${m.kind}) — \`${m.file_path}:${m.line_start}\``);
    }
    return lines.join('\n');
}
// ---------------------------------------------------------------------------
// formatBrief
// ---------------------------------------------------------------------------
/**
 * Format a full codebase briefing as a structured Markdown document.
 */
export function formatBrief(brief) {
    const lines = [];
    lines.push('# Codebase Briefing');
    lines.push('');
    // --- Overview ---
    lines.push('## Overview');
    lines.push('');
    lines.push(`- **files:** ${brief.overview.totalFiles}`);
    lines.push(`- **symbols:** ${brief.overview.totalSymbols}`);
    lines.push(`- **edges:** ${brief.overview.totalEdges}`);
    if (brief.overview.lastIndexedAt) {
        lines.push(`- **Last indexed:** ${brief.overview.lastIndexedAt}`);
    }
    if (brief.overview.lastIndexedCommit) {
        lines.push(`- **Last commit:** ${brief.overview.lastIndexedCommit}`);
    }
    if (Object.keys(brief.overview.languages).length > 0) {
        const langSummary = Object.entries(brief.overview.languages)
            .map(([lang, count]) => `${lang}: ${count}`)
            .join(', ');
        lines.push(`- **Languages:** ${langSummary}`);
    }
    lines.push('');
    // --- Module Map ---
    lines.push('## Module Map');
    lines.push('');
    if (brief.modules.length === 0) {
        lines.push('_No modules found._');
    }
    else {
        lines.push('| Module | Files | Symbols | Depends On |');
        lines.push('| ------ | ----: | ------: | ---------- |');
        for (const mod of brief.modules) {
            const dependsOn = mod.dependsOn.length > 0 ? mod.dependsOn.join(', ') : '—';
            lines.push(`| \`${mod.path}\` | ${mod.fileCount} | ${mod.symbolCount} | ${dependsOn} |`);
        }
    }
    lines.push('');
    // --- Critical Hotspots ---
    lines.push('## Critical Hotspots (most called)');
    lines.push('');
    if (brief.hotspots.length === 0) {
        lines.push('_No hotspots found._');
    }
    else {
        lines.push('| Symbol | File | Line | Callers |');
        lines.push('| ------ | ---- | ---: | ------: |');
        for (const h of brief.hotspots) {
            lines.push(`| \`${h.symbolName}\` | \`${h.filePath}\` | ${h.lineStart} | ${h.callerCount} |`);
        }
    }
    lines.push('');
    // --- Entry Points ---
    lines.push('## Entry Points');
    lines.push('');
    if (brief.entryPoints.length === 0) {
        lines.push('_No entry points found._');
    }
    else {
        // Group by category
        const byCategory = new Map();
        for (const ep of brief.entryPoints) {
            const arr = byCategory.get(ep.category) ?? [];
            arr.push(ep);
            byCategory.set(ep.category, arr);
        }
        for (const [category, entries] of byCategory.entries()) {
            const label = category === 'api-route' ? 'API Routes'
                : category === 'page' ? 'Pages'
                    : category === 'action' ? 'Server Actions'
                        : 'Exported Symbols';
            lines.push(`### ${label}`);
            lines.push('');
            for (const ep of entries) {
                lines.push(`- \`${ep.symbolName}\` — \`${ep.filePath}\`:${ep.lineStart}`);
            }
            lines.push('');
        }
    }
    // --- Change Risk Zones ---
    lines.push('## Change Risk Zones');
    lines.push('');
    if (brief.riskZones.length === 0) {
        lines.push('_No file dependency data available._');
    }
    else {
        lines.push('| File | Dependents | Risk |');
        lines.push('| ---- | ---------: | ---- |');
        const top10 = brief.riskZones.slice(0, 10);
        for (const rz of top10) {
            lines.push(`| \`${rz.filePath}\` | ${rz.dependentCount} | ${rz.risk} |`);
        }
    }
    lines.push('');
    // --- Dependency Clusters ---
    lines.push('## Dependency Clusters (bidirectional)');
    lines.push('');
    if (brief.coupledPairs.length === 0) {
        lines.push('_No tightly-coupled file pairs detected._');
    }
    else {
        for (const pair of brief.coupledPairs) {
            lines.push(`- \`${pair.fileA}\` ↔ \`${pair.fileB}\``);
        }
    }
    return lines.join('\n');
}
// ---------------------------------------------------------------------------
// formatStatus
// ---------------------------------------------------------------------------
/**
 * Format index status as Markdown.
 */
export function formatStatus(status) {
    const lines = [];
    lines.push('## CodeGraph Index Status');
    lines.push('');
    lines.push(`- **Files:** ${status.totalFiles} files (${status.staleFiles} stale)`);
    lines.push(`- **Symbols:** ${status.totalSymbols} symbols`);
    lines.push(`- **Edges:** ${status.totalEdges} edges`);
    lines.push(`- **Schema version:** ${status.schemaVersion}`);
    if (status.lastIndexedAt) {
        lines.push(`- **Last indexed:** ${status.lastIndexedAt}`);
    }
    if (status.lastIndexedCommit) {
        lines.push(`- **Last commit:** ${status.lastIndexedCommit}`);
    }
    if (Object.keys(status.languages).length > 0) {
        lines.push('');
        lines.push('### Languages');
        lines.push('');
        for (const [lang, count] of Object.entries(status.languages)) {
            lines.push(`- ${lang}: ${count}`);
        }
    }
    return lines.join('\n');
}
//# sourceMappingURL=formatter.js.map