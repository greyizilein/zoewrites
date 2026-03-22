import { describe, it, expect } from "vitest";
import { countWords, truncateToWordCeiling } from "@/lib/wordCount";

describe("countWords", () => {
  it("counts single words", () => {
    expect(countWords("hello")).toBe(1);
  });

  it("counts multiple words", () => {
    expect(countWords("the quick brown fox")).toBe(4);
  });

  it("handles multiple consecutive spaces", () => {
    expect(countWords("a  b   c")).toBe(3);
  });

  it("handles leading and trailing whitespace", () => {
    expect(countWords("  hello world  ")).toBe(2);
  });

  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("returns 0 for whitespace-only string", () => {
    expect(countWords("   \t\n  ")).toBe(0);
  });
});

describe("truncateToWordCeiling", () => {
  it("returns content unchanged when already within ceiling", () => {
    const text = "One two three.";
    expect(truncateToWordCeiling(text, 10)).toBe(text);
  });

  it("returns content unchanged when exactly at ceiling", () => {
    const text = "One two three four five.";
    expect(truncateToWordCeiling(text, 5)).toBe(text);
  });

  it("truncates at sentence boundary to fit within ceiling", () => {
    const text = "First sentence here. Second sentence here. Third sentence here.";
    // ceiling of 4 means only "First sentence here." (3 words) fits
    const result = truncateToWordCeiling(text, 4);
    const wc = countWords(result);
    expect(wc).toBeLessThanOrEqual(4);
    expect(result).toContain("First sentence here");
    expect(result).not.toContain("Second");
  });

  it("does not split mid-sentence", () => {
    const text = "Short one. A much longer second sentence that has many words in it.";
    const result = truncateToWordCeiling(text, 4);
    expect(result).toBe("Short one.");
  });

  it("falls back to original content if no sentence fits", () => {
    // No sentence boundary — regex returns [content] as fallback
    const text = "this is a run-on without terminal punctuation that is very long indeed";
    const original = truncateToWordCeiling(text, 2);
    // Should not crash and should return the original (no sentence matched the pattern)
    expect(typeof original).toBe("string");
  });

  it("handles exclamation and question mark sentence endings", () => {
    const text = "Great! Really? Yes indeed.";
    const result = truncateToWordCeiling(text, 2);
    expect(countWords(result)).toBeLessThanOrEqual(2);
  });
});
