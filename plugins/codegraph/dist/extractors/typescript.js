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
                return qualifyWithinNamespace(current, name).qualifiedName;
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
                    return qualifyWithinNamespace(parent, varName.text).qualifiedName;
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
            if (nameNode) {
                const namespace = findEnclosingNamespace(current);
                return namespace ? `${namespace}.${nameNode.text}` : nameNode.text;
            }
        }
        current = current.parent;
    }
    return null;
}
function findEnclosingNamespace(node) {
    const names = [];
    let current = node.parent;
    while (current !== null) {
        if (current.type === 'internal_module') {
            const name = getNameText(current);
            if (name)
                names.unshift(name);
        }
        current = current.parent;
    }
    return names.length > 0 ? names.join('.') : null;
}
function qualifyWithinNamespace(node, name) {
    const namespace = findEnclosingNamespace(node);
    if (!namespace) {
        return { qualifiedName: name, containerName: '' };
    }
    return {
        qualifiedName: `${namespace}.${name}`,
        containerName: namespace,
    };
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
                        const { qualifiedName, containerName } = qualifyWithinNamespace(node, name);
                        symbols.push({
                            name,
                            qualified_name: qualifiedName,
                            container_name: containerName,
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
                        const { qualifiedName, containerName } = qualifyWithinNamespace(node, name);
                        symbols.push({
                            name,
                            qualified_name: qualifiedName,
                            container_name: containerName,
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
                            const { qualifiedName, containerName } = qualifyWithinNamespace(node, nameNode.text);
                            symbols.push({
                                name: nameNode.text,
                                qualified_name: qualifiedName,
                                container_name: containerName,
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
                        const { qualifiedName, containerName } = qualifyWithinNamespace(node, name);
                        symbols.push({
                            name,
                            qualified_name: qualifiedName,
                            container_name: containerName,
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
                        const { qualifiedName, containerName } = qualifyWithinNamespace(node, name);
                        symbols.push({
                            name,
                            qualified_name: qualifiedName,
                            container_name: containerName,
                            kind: 'type',
                            line_start: node.startPosition.row + 1,
                            line_end: node.endPosition.row + 1,
                            exported,
                        });
                    }
                    break;
                }
                case 'enum_declaration': {
                    const name = getNameText(node);
                    if (name) {
                        const exported = isExported(node);
                        const { qualifiedName, containerName } = qualifyWithinNamespace(node, name);
                        symbols.push({
                            name,
                            qualified_name: qualifiedName,
                            container_name: containerName,
                            kind: 'enum',
                            line_start: node.startPosition.row + 1,
                            line_end: node.endPosition.row + 1,
                            exported,
                        });
                    }
                    break;
                }
                case 'internal_module': {
                    const name = getNameText(node);
                    if (name) {
                        const outerNamespace = findEnclosingNamespace(node);
                        const qualifiedName = outerNamespace ? `${outerNamespace}.${name}` : name;
                        symbols.push({
                            name,
                            qualified_name: qualifiedName,
                            container_name: outerNamespace ?? '',
                            kind: 'namespace',
                            line_start: node.startPosition.row + 1,
                            line_end: node.endPosition.row + 1,
                            exported: isExported(node),
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
                const namespaceExportNode = node.namedChildren.find((c) => c.type === 'namespace_export');
                if (!sourceNode)
                    continue;
                const rawSource = sourceNode.namedChildren.find((c) => c.type === 'string_fragment')?.text;
                if (!rawSource)
                    continue;
                if (clauseNode) {
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
                    continue;
                }
                if (namespaceExportNode) {
                    const namespaceName = namespaceExportNode.namedChildren.find((c) => c.type === 'identifier')?.text;
                    imports.push({
                        specifiers: namespaceName ? [`* as ${namespaceName}`] : ['*'],
                        source: rawSource,
                        kind: 'import',
                    });
                    continue;
                }
                if (sourceNode) {
                    imports.push({
                        specifiers: ['*'],
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
    const specifiers = [];
    for (const child of clauseNode.namedChildren) {
        if (child.type === 'identifier') {
            specifiers.push(child.text);
            continue;
        }
        if (child.type === 'named_imports') {
            specifiers.push(...child.namedChildren
                .filter((c) => c.type === 'import_specifier')
                .map((spec) => {
                const alias = spec.childForFieldName('alias')?.text;
                return alias ?? spec.childForFieldName('name')?.text ?? spec.namedChildren[0]?.text ?? spec.text;
            })
                .filter(Boolean));
            continue;
        }
        if (child.type === 'namespace_import') {
            const namespaceName = child.namedChildren.find((c) => c.type === 'identifier')?.text;
            if (namespaceName)
                specifiers.push(namespaceName);
        }
    }
    return specifiers;
}
//# sourceMappingURL=typescript.js.map