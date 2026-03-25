import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _cached = null;

/**
 * Load and cache the two canonical JSON schemas.
 * @param {string} [schemaDir] - Override path to schema directory
 * @returns {{ structure: object, frontmatter: object }}
 */
export function loadSchemas(schemaDir) {
  if (_cached && !schemaDir) return _cached;

  const dir = schemaDir ?? join(__dirname, '..', 'schema');
  const structure = JSON.parse(readFileSync(join(dir, 'knowledge-structure.json'), 'utf8'));
  const frontmatter = JSON.parse(readFileSync(join(dir, 'frontmatter-schemas.json'), 'utf8'));

  if (!structure.areas || typeof structure.areas !== 'object') {
    throw new Error('knowledge-structure.json: missing or invalid "areas" object');
  }
  if (!frontmatter.types || typeof frontmatter.types !== 'object') {
    throw new Error('frontmatter-schemas.json: missing or invalid "types" object');
  }

  // Validate extended schema fields
  if (frontmatter.field_values && typeof frontmatter.field_values !== 'object') {
    throw new Error('frontmatter-schemas.json: "field_values" must be an object if present');
  }
  if (structure.extension_areas && typeof structure.extension_areas !== 'object') {
    throw new Error('knowledge-structure.json: "extension_areas" must be an object if present');
  }
  for (const [areaKey, areaDef] of Object.entries(structure.areas)) {
    if (areaDef.filenameRules && typeof areaDef.filenameRules !== 'object') {
      throw new Error(`knowledge-structure.json: areas.${areaKey}.filenameRules must be an object if present`);
    }
  }

  const result = { structure, frontmatter };
  if (!schemaDir) _cached = result;
  return result;
}

/**
 * Clear the schema cache (useful in tests).
 */
export function clearSchemaCache() {
  _cached = null;
}
