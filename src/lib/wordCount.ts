/** Counts whitespace-delimited words in a string. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
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
