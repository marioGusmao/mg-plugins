import type Parser from 'tree-sitter';
import type { ExtractedSymbol, ExtractedEdge, ExtractedImport, LanguageExtractor } from '../core/types.js';
export declare class TypeScriptExtractor implements LanguageExtractor {
    readonly language = "typescript";
    readonly extensions: string[];
    extractSymbols(tree: Parser.Tree, _source: string): ExtractedSymbol[];
    extractEdges(tree: Parser.Tree, _source: string): ExtractedEdge[];
    extractImports(tree: Parser.Tree, _source: string): ExtractedImport[];
}
