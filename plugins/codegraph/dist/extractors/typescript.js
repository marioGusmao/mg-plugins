// ----------------------------------------------------------------
// AST traversal helpers
// ----------------------------------------------------------------
function collectNodes(node, predicate, results = []) {
    if (predicate(node))
        results.push(node);
    for (const child of node.children) {
        collectNodes(child, predicate, results);
    }
    return results;
}
/** Return the identifier text for a node, or null if none found. */
function getNameText(node) {
    // function_declaration, class_declaration: first named child is the identifier
    const nameChild = node.childForFieldName('name') ??
        node.namedChildren.find((c) => c.type === 'identifier' || c.type === 'type_identifier' || c.type === 'property_identifier') ??
        null;
    return nameChild?.text ?? null;
}
/** Walk ancestors to find the nearest enclosing named function/method. */
function findEnclosingFunction(node) {
    let current = node.parent;
    while (current !== null) {
        if (current.type === 'function_declaration' || current.type === 'function') {
            const name = getNameText(current);
            if (name)
                return name;
        }
        if (current.type === 'method_definition') {
            const methodName = getNameText(current);
            const classNode = findEnclosingClass(current);
            if (methodName && classNode)
                return `${classNode}.${methodName}`;
            if (methodName)
                return methodName;
        }
        if (current.type === 'arrow_function') {
            // Arrow function in a variable declarator — get the variable name
            const parent = current.parent;
            if (parent?.type === 'variable_declarator') {
                const varName = parent.childForFieldName('name') ?? parent.namedChildren[0];
                if (varName)
                    return varName.text;
            }
        }
        current = current.parent;
    }
    return null;
}
/** Walk ancestors to find the nearest enclosing class name. */
function findEnclosingClass(node) {
    let current = node.parent;
    while (current !== null) {
        if (current.type === 'class_declaration' || current.type === 'class') {
            const nameNode = current.childForFieldName('name') ??
                current.namedChildren.find((c) => c.type === 'type_identifier');
            if (nameNode)
                return nameNode.text;
        }
        current = current.parent;
    }
    return null;
}
/** True when the node is a direct child of an export_statement. */
function isExported(node) {
    return node.parent?.type === 'export_statement';
}
// ----------------------------------------------------------------
// TypeScriptExtractor
// ----------------------------------------------------------------
export class TypeScriptExtractor {
    language = 'typescript';
    extensions = ['.ts', '.tsx', '.js', '.jsx'];
    extractSymbols(tree, _source) {
        const symbols = [];
        const root = tree.rootNode;
        const visit = (node) => {
            switch (node.type) {
                case 'function_declaration': {
                    const name = getNameText(node);
                    if (name) {
                        const exported = isExported(node);
                        symbols.push({
                            name,
                            qualified_name: name,
                            container_name: '',
                            kind: 'function',
                            line_start: node.startPosition.row + 1,
                            line_end: node.endPosition.row + 1,
                            exported,
                        });
                    }
                    break;
                }
                case 'class_declaration': {
                    const name = node.childForFieldName('name')?.text ??
                        node.namedChildren.find((c) => c.type === 'type_identifier')?.text ??
                        null;
                    if (name) {
                        const exported = isExported(node);
                        symbols.push({
                            name,
                            qualified_name: name,
                            container_name: '',
                            kind: 'class',
                            line_start: node.startPosition.row + 1,
                            line_end: node.endPosition.row + 1,
                            exported,
                        });
                    }
                    break;
                }
                case 'method_definition': {
                    const methodName = node.childForFieldName('name')?.text ??
                        node.namedChildren.find((c) => c.type === 'property_identifier' || c.type === 'identifier')?.text ??
                        null;
                    const className = findEnclosingClass(node);
                    if (methodName) {
                        const qualifiedName = className ? `${className}.${methodName}` : methodName;
                        symbols.push({
                            name: methodName,
                            qualified_name: qualifiedName,
                            container_name: className ?? '',
                            kind: 'method',
                            line_start: node.startPosition.row + 1,
                            line_end: node.endPosition.row + 1,
                            exported: false, // methods are not individually exported
                        });
                    }
                    break;
                }
                case 'variable_declarator': {
                    // Detect: const foo = (...) => ...  or  const foo = function ...
                    const valueNode = node.childForFieldName('value') ?? node.namedChildren[1];
                    if (valueNode &&
                        (valueNode.type === 'arrow_function' || valueNode.type === 'function')) {
                        const nameNode = node.childForFieldName('name') ?? node.namedChildren[0];
                        if (nameNode) {
                            // exported if grandparent chain reaches export_statement
                            const exported = isExportedVariableDeclarator(node);
                            symbols.push({
                                name: nameNode.text,
                                qualified_name: nameNode.text,
                                container_name: '',
                                kind: 'function',
                                line_start: node.startPosition.row + 1,
                                line_end: node.endPosition.row + 1,
                                exported,
                            });
                        }
                    }
                    break;
                }
                case 'type_alias_declaration': {
                    const name = node.childForFieldName('name')?.text ??
                        node.namedChildren.find((c) => c.type === 'type_identifier')?.text ??
                        null;
                    if (name) {
                        const exported = isExported(node);
                        symbols.push({
                            name,
                            qualified_name: name,
                            container_name: '',
                            kind: 'type',
                            line_start: node.startPosition.row + 1,
                            line_end: node.endPosition.row + 1,
                            exported,
                        });
                    }
                    break;
                }
                case 'interface_declaration': {
                    const name = node.childForFieldName('name')?.text ??
                        node.namedChildren.find((c) => c.type === 'type_identifier')?.text ??
                        null;
                    if (name) {
                        const exported = isExported(node);
                        symbols.push({
                            name,
                            qualified_name: name,
                            container_name: '',
                            kind: 'type',
                            line_start: node.startPosition.row + 1,
                            line_end: node.endPosition.row + 1,
                            exported,
                        });
                    }
                    break;
                }
            }
            for (const child of node.children) {
                visit(child);
            }
        };
        visit(root);
        return symbols;
    }
    extractEdges(tree, _source) {
        const edges = [];
        const callNodes = collectNodes(tree.rootNode, (n) => n.type === 'call_expression');
        for (const callNode of callNodes) {
            const functionNode = callNode.childForFieldName('function') ?? callNode.namedChildren[0];
            if (!functionNode)
                continue;
            // Get the target name — handle simple identifiers and member expressions
            let targetName = null;
            if (functionNode.type === 'identifier') {
                targetName = functionNode.text;
            }
            else if (functionNode.type === 'member_expression') {
                // e.g. db.insertEdge(...) — extract only the property ("insertEdge"),
                // not the full text ("db.insertEdge"), so it can match indexed symbols by simple name.
                targetName = functionNode.childForFieldName('property')?.text ?? functionNode.text;
            }
            if (!targetName)
                continue;
            const sourceQualifiedName = findEnclosingFunction(callNode);
            if (!sourceQualifiedName)
                continue;
            edges.push({
                sourceQualifiedName,
                targetName,
                targetImport: null,
                kind: 'calls',
                confidence: 'syntactic',
            });
        }
        return edges;
    }
    extractImports(tree, _source) {
        const imports = [];
        const root = tree.rootNode;
        for (const node of root.namedChildren) {
            // Standard import: import { X, Y } from './module'
            if (node.type === 'import_statement') {
                const sourceNode = node.namedChildren.find((c) => c.type === 'string');
                const rawSource = sourceNode?.namedChildren.find((c) => c.type === 'string_fragment')?.text;
                if (!rawSource)
                    continue;
                const clauseNode = node.namedChildren.find((c) => c.type === 'import_clause');
                const specifiers = extractImportSpecifiers(clauseNode ?? null);
                imports.push({
                    specifiers,
                    source: rawSource,
                    kind: 'import',
                });
            }
            // Re-export: export { X } from './module'
            if (node.type === 'export_statement') {
                const sourceNode = node.namedChildren.find((c) => c.type === 'string');
                const clauseNode = node.namedChildren.find((c) => c.type === 'export_clause');
                if (sourceNode && clauseNode) {
                    const rawSource = sourceNode.namedChildren.find((c) => c.type === 'string_fragment')?.text;
                    if (!rawSource)
                        continue;
                    const specifiers = clauseNode
                        .namedChildren
                        .filter((c) => c.type === 'export_specifier')
                        .map((spec) => {
                        // export_specifier may have a 'name' field (the local name)
                        return (spec.childForFieldName('name')?.text ??
                            spec.namedChildren.find((c) => c.type === 'identifier')?.text ??
                            spec.text);
                    })
                        .filter(Boolean);
                    imports.push({
                        specifiers,
                        source: rawSource,
                        kind: 'import',
                    });
                }
            }
        }
        return imports;
    }
}
// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
/** Check if a variable_declarator is inside an export_statement. */
function isExportedVariableDeclarator(node) {
    // variable_declarator -> lexical_declaration / variable_declaration -> export_statement
    const lexDecl = node.parent;
    const exportStmt = lexDecl?.parent;
    return exportStmt?.type === 'export_statement';
}
/** Extract named import specifiers from an import_clause node. */
function extractImportSpecifiers(clauseNode) {
    if (!clauseNode)
        return [];
    const named = clauseNode.namedChildren.find((c) => c.type === 'named_imports');
    if (!named)
        return [];
    return named.namedChildren
        .filter((c) => c.type === 'import_specifier')
        .map((spec) => {
        // import_specifier first named child is the identifier
        return spec.namedChildren[0]?.text ?? spec.text;
    })
        .filter(Boolean);
}
//# sourceMappingURL=typescript.js.map