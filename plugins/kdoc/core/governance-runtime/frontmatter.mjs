import { parseDocument } from 'yaml';
import { z } from 'zod';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Build a Zod schema dynamically from a frontmatter type definition.
 * @param {object} typeDef - Entry from frontmatter-schemas.json types
 * @param {object} [fieldValues] - Top-level field_values constraints
 * @returns {import('zod').ZodObject}
 */
export function buildZodSchema(typeDef, fieldValues) {
  const shape = {};

  for (const field of typeDef.required ?? []) {
    if (field === 'status' && typeDef.status_values) {
      shape[field] = z.enum(typeDef.status_values);
    } else if (field === 'id' && typeDef.id_pattern) {
      shape[field] = z.string().regex(new RegExp(typeDef.id_pattern));
    } else {
      shape[field] = z.string().min(1);
    }
  }

  for (const field of typeDef.optional ?? []) {
    if (fieldValues && fieldValues[field]) {
      shape[field] = z.enum(fieldValues[field]).optional();
    } else {
      shape[field] = z.any().optional();
    }
  }

  return z.object(shape).passthrough();
}

/**
 * Extract and parse YAML frontmatter from file content.
 * @param {string} content - Full file content
 * @returns {{ parsed: object|null, errors: Array<{line?: number, message: string}>, raw: string }}
 */
export function parseFrontmatter(content) {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return { parsed: null, errors: [{ message: 'No YAML frontmatter found' }], raw: '' };
  }

  const raw = match[1];
  const errors = [];

  try {
    const doc = parseDocument(raw, { version: '1.2', schema: 'core', customTags: [] });

    for (const err of doc.errors) {
      errors.push({ line: err.pos?.[0], message: err.message });
    }
    for (const warn of doc.warnings) {
      errors.push({ line: warn.pos?.[0], message: `warning: ${warn.message}` });
    }

    const parsed = doc.toJS();
    return { parsed, errors, raw };
  } catch (err) {
    return { parsed: null, errors: [{ message: `YAML parse error: ${err.message}` }], raw };
  }
}

/**
 * Validate frontmatter against a document type's schema.
 * @param {string} content - Full file content
 * @param {string} docType - Document type key (e.g., 'adr', 'feature')
 * @param {{ frontmatter: object }} schemas - Loaded schemas
 * @returns {{ valid: boolean, errors: Array<{path?: string, message: string}>, parsed: object|null }}
 */
export function validateFrontmatter(content, docType, schemas) {
  const { parsed, errors: parseErrors } = parseFrontmatter(content);

  if (!parsed) {
    return { valid: false, errors: parseErrors, parsed: null };
  }

  const typeDef = schemas.frontmatter.types[docType];
  if (!typeDef) {
    return { valid: false, errors: [{ message: `Unknown document type: ${docType}` }], parsed };
  }

  const zodSchema = buildZodSchema(typeDef, schemas.frontmatter.field_values);
  const result = zodSchema.safeParse(parsed);

  if (!result.success) {
    const zodErrors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return { valid: false, errors: [...parseErrors, ...zodErrors], parsed };
  }

  return { valid: parseErrors.length === 0, errors: parseErrors, parsed };
}

/**
 * Detect document type from frontmatter 'type' field.
 * @param {string} content - Full file content
 * @returns {string|null}
 */
export function detectDocType(content) {
  const { parsed } = parseFrontmatter(content);
  if (!parsed || !parsed.type) return null;
  return String(parsed.type);
}
