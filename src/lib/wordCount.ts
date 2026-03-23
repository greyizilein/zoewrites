/** Strips the ## References block from content, returning body text only. */
export function getBodyContent(content: string): string {
  return content.replace(/\n## References[\s\S]*$/i, "").trim();
}

/** Counts whitespace-delimited words in a string. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Counts body words only — excludes the ## References block. */
export function countBodyWords(text: string): number {
  return countWords(getBodyContent(text));
}

/**
 * Truncates content at sentence boundaries so it fits within `ceiling` words.
 * Returns the original content unchanged if it is already within the ceiling.
 */
export function truncateToWordCeiling(content: string, ceiling: number): string {
  if (countWords(content) <= ceiling) return content;

  const sentences = content.match(/[^.!?]+[.!?]+/g) ?? [content];
  let trimmed = "";
  let wc = 0;

  for (const sent of sentences) {
    const sWc = countWords(sent.trim());
    if (wc + sWc > ceiling) break;
    trimmed += sent;
    wc += sWc;
  }

  return trimmed.trim() || content;
}
