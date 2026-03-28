/**
 * Reads an OpenAI-compatible Server-Sent Events stream, accumulating the
 * `choices[0].delta.content` tokens from each chunk.
 *
 * @param body   The ReadableStream from a fetch response.
 * @param onChunk  Optional callback called with the running full content after
 *                 each token is appended.
 * @returns The complete accumulated content string.
 */
export async function readContentStream(
  body: ReadableStream<Uint8Array>,
  onChunk?: (fullContent: string) => void,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") break;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullContent += content;
          onChunk?.(fullContent);
        }
      } catch (e) {
        // Warn on parse failures so we can debug malformed SSE chunks.
        console.warn("[sseStream] failed to parse chunk:", jsonStr, e);
      }
    }
  }

  return fullContent;
}

/**
 * Same as readContentStream but also accumulates tool_calls deltas.
 * Returns both the assistant text content and a list of completed tool calls.
 */
export interface ToolCall {
  name: string;
  arguments: string;
}

export async function readContentAndToolStream(
  body: ReadableStream<Uint8Array>,
  onContentChunk?: (fullContent: string) => void,
): Promise<{ content: string; toolCalls: ToolCall[] }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolBuffer: { name: string; arguments: string }[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") break;
      try {
        const parsed = JSON.parse(jsonStr);
        const chunk = parsed.choices?.[0]?.delta?.content;
        if (chunk) {
          content += chunk;
          onContentChunk?.(content);
        }
        const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
        if (toolCalls) {
          for (const tc of toolCalls) {
            if (tc.index !== undefined) {
              if (!toolBuffer[tc.index]) toolBuffer[tc.index] = { name: "", arguments: "" };
              if (tc.function?.name) toolBuffer[tc.index].name = tc.function.name;
              if (tc.function?.arguments) toolBuffer[tc.index].arguments += tc.function.arguments;
            }
          }
        }
      } catch (e) {
        console.warn("[sseStream] failed to parse tool-stream chunk:", jsonStr, e);
      }
    }
  }

  return { content, toolCalls: toolBuffer.filter(tc => tc.name) };
}
