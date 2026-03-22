import type { CallerResult, DependsResult, StatusResult } from './types.js';
import type { BriefResult, DisambiguationMatch, DocRefResult, SearchResult } from './query-engine.js';
/**
 * Format caller results as Markdown with depth grouping and an impact summary.
 */
export declare function formatCallers(symbolName: string, filePath: string, line: number, results: CallerResult[]): string;
/**
 * Format callee results as Markdown with depth grouping.
 */
export declare function formatCallees(symbolName: string, filePath: string, line: number, results: CallerResult[]): string;
/**
 * Format blast-radius results as Markdown.
 */
export declare function formatBlast(symbolName: string, callers: CallerResult[], callees: CallerResult[], affectedFiles: string[], docReferences?: DocRefResult[]): string;
/**
 * Format documentation references as a Markdown section.
 */
export declare function formatDocReferences(refs: DocRefResult[]): string;
/**
 * Format file dependency results as Markdown.
 */
export declare function formatDepends(file: string, results: DependsResult[]): string;
/**
 * Format symbol search results as Markdown.
 */
export declare function formatSearch(query: string, results: SearchResult[]): string;
/**
 * Format a disambiguation listing as Markdown.
 */
export declare function formatDisambiguation(name: string, matches: DisambiguationMatch[]): string;
/**
 * Format a full codebase briefing as a structured Markdown document.
 */
export declare function formatBrief(brief: BriefResult): string;
/**
 * Format index status as Markdown.
 */
export declare function formatStatus(status: StatusResult): string;
