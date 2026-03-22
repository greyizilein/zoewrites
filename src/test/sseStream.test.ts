import { describe, it, expect, vi } from "vitest";
import { readContentStream, readContentAndToolStream } from "@/lib/sseStream";

/** Build a ReadableStream from a list of raw SSE lines. */
function makeStream(lines: string[]): ReadableStream<Uint8Array> {
  const text = lines.join("\n") + "\n";
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function sseChunk(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}`;
}

function sseDone(): string {
  return "data: [DONE]";
}

describe("readContentStream", () => {
  it("accumulates content from multiple chunks", async () => {
    const stream = makeStream([sseChunk("Hello"), sseChunk(", "), sseChunk("world"), sseDone()]);
    const result = await readContentStream(stream);
    expect(result).toBe("Hello, world");
  });

  it("calls onChunk after each token", async () => {
    const onChunk = vi.fn();
    const stream = makeStream([sseChunk("A"), sseChunk("B"), sseChunk("C"), sseDone()]);
    await readContentStream(stream, onChunk);
    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(onChunk).toHaveBeenLastCalledWith("ABC");
  });

  it("ignores non-data lines", async () => {
    const stream = makeStream(["event: ping", ": keep-alive", sseChunk("hi"), sseDone()]);
    const result = await readContentStream(stream);
    expect(result).toBe("hi");
  });

  it("stops at [DONE]", async () => {
    const stream = makeStream([sseChunk("before"), sseDone(), sseChunk("after")]);
    const result = await readContentStream(stream);
    expect(result).toBe("before");
  });

  it("ignores malformed JSON chunks without throwing", async () => {
    const stream = makeStream(["data: {broken", sseChunk("ok"), sseDone()]);
    const result = await readContentStream(stream);
    expect(result).toBe("ok");
  });

  it("returns empty string for stream with no content tokens", async () => {
    const stream = makeStream([sseDone()]);
    const result = await readContentStream(stream);
    expect(result).toBe("");
  });

  it("handles CRLF line endings", async () => {
    const text = `${sseChunk("X")}\r\n${sseDone()}\r\n`;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(text));
        c.close();
      },
    });
    const result = await readContentStream(stream);
    expect(result).toBe("X");
  });
});

describe("readContentAndToolStream", () => {
  it("accumulates text content and tool calls", async () => {
    const toolChunk = `data: ${JSON.stringify({
      choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "write_all", arguments: '{"confirm' } }] } }],
    })}`;
    const toolChunk2 = `data: ${JSON.stringify({
      choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ed":true}' } }] } }],
    })}`;
    const stream = makeStream([sseChunk("Hi"), toolChunk, toolChunk2, sseDone()]);
    const { content, toolCalls } = await readContentAndToolStream(stream);
    expect(content).toBe("Hi");
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].name).toBe("write_all");
    expect(JSON.parse(toolCalls[0].arguments)).toEqual({ confirmed: true });
  });

  it("filters out tool calls with no name", async () => {
    const tc = `data: ${JSON.stringify({
      choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "{}" } }] } }],
    })}`;
    const stream = makeStream([tc, sseDone()]);
    const { toolCalls } = await readContentAndToolStream(stream);
    expect(toolCalls).toHaveLength(0);
  });
});
