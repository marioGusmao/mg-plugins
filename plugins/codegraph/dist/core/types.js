export function buildSymbolUid(filePath, containerName, name, kind, lineStart) {
    return `${filePath}:${containerName || '_'}:${name}:${kind}:${lineStart}`;
}
export const SCHEMA_VERSION = '1.0';
export const MAX_DEPTH = 15;
export const MAX_RESULTS = 200;
export const QUERY_TIMEOUT_MS = 5000;
//# sourceMappingURL=types.js.map