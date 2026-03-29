const INLINE_CODE_SPAN_RE = /`[^`]*`/g;

/**
 * Mask inline code spans so callers can safely transform surrounding prose.
 *
 * @param {string} content
 * @returns {{ masked: string, restore: (modified: string) => string }}
 */
export function maskCodeSpans(content) {
  const replacements = [];
  let index = 0;

  const masked = content.replace(INLINE_CODE_SPAN_RE, (match) => {
    const placeholder = `\x00CS${index}\x00`;
    index += 1;
    replacements.push({ placeholder, original: match });
    return placeholder;
  });

  return {
    masked,
    restore(modified) {
      let restored = modified;
      for (const { placeholder, original } of replacements) {
        restored = restored.split(placeholder).join(original);
      }
      return restored;
    },
  };
}
