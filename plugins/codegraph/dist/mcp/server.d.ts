export interface ToolResponse {
    [x: string]: unknown;
    content: Array<{
        type: 'text';
        text: string;
    }>;
    structuredContent: Record<string, unknown>;
}
export interface SearchInput {
    query: string;
    kind?: string;
}
export interface CallerCalleeInput {
    symbol?: string;
    file?: string;
    qualified_name?: string;
    symbol_uid?: string;
    depth?: number;
}
export interface DependsInput {
    file: string;
    direction?: 'in' | 'out' | 'both';
}
export interface StatusInput {
}
export interface ToolHandlers {
    codegraph_brief: (input: StatusInput) => Promise<ToolResponse>;
    codegraph_status: (input: StatusInput) => Promise<ToolResponse>;
    codegraph_search: (input: SearchInput) => Promise<ToolResponse>;
    codegraph_callers: (input: CallerCalleeInput) => Promise<ToolResponse>;
    codegraph_callees: (input: CallerCalleeInput) => Promise<ToolResponse>;
    codegraph_blast: (input: CallerCalleeInput) => Promise<ToolResponse>;
    codegraph_depends: (input: DependsInput) => Promise<ToolResponse>;
    close?: () => void;
}
export declare function createToolHandlers(projectDir: string, options?: {
    sharedConnection?: boolean;
}): ToolHandlers;
export declare function getPackageVersion(): string;
export declare function startServer(projectDir: string): Promise<void>;
/**
 * Parse the --project argument from process.argv.
 * Falls back to process.cwd() when not specified or when the value is empty/whitespace.
 */
export declare function parseProjectDir(argv: string[]): string;
