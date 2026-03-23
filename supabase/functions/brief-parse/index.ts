import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";
import { getZoeIdentityHeader } from "../_shared/zoe-brain.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Decode base64 to Uint8Array */
function b64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/** Extract plain text from a DOCX (ZIP containing word/document.xml) */
async function extractDocxText(b64: string): Promise<string> {
  try {
    const zip = new JSZip();
    await zip.loadAsync(b64ToUint8(b64));
    const docXml = await zip.file("word/document.xml")?.async("text");
    if (!docXml) return "[Could not extract DOCX content]";
    // Strip XML tags, decode entities, clean whitespace
    return docXml
      .replace(/<w:br[^>]*\/>/gi, "\n")
      .replace(/<\/w:p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'").replace(/&quot;/g, '"')
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch (e) {
    console.error("DOCX extraction failed:", e);
    return "[DOCX extraction failed]";
  }
}

/** Extract text from XLSX (ZIP containing xl/sharedStrings.xml + xl/worksheets) */
async function extractXlsxText(b64: string): Promise<string> {
  try {
    const zip = new JSZip();
    await zip.loadAsync(b64ToUint8(b64));
    const parts: string[] = [];
    // Shared strings
    const ss = await zip.file("xl/sharedStrings.xml")?.async("text");
    if (ss) {
      const strings = [...ss.matchAll(/<t[^>]*>([^<]*)<\/t>/gi)].map(m => m[1]);
      parts.push("Shared strings: " + strings.join(", "));
    }
    // Worksheet data
    for (const [path, file] of Object.entries(zip.files)) {
      if (path.startsWith("xl/worksheets/") && path.endsWith(".xml")) {
        const xml = await (file as any).async("text");
        const vals = [...xml.matchAll(/<v>([^<]*)<\/v>/gi)].map(m => m[1]);
        if (vals.length) parts.push(`${path}: ${vals.join(", ")}`);
      }
    }
    return parts.join("\n") || "[No readable XLSX content]";
  } catch {
    return "[XLSX extraction failed]";
  }
}

/** Extract text from PPTX */
async function extractPptxText(b64: string): Promise<string> {
  try {
    const zip = new JSZip();
    await zip.loadAsync(b64ToUint8(b64));
    const parts: string[] = [];
    for (const [path, file] of Object.entries(zip.files)) {
      if (path.startsWith("ppt/slides/slide") && path.endsWith(".xml")) {
        const xml = await (file as any).async("text");
        const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/gi)].map(m => m[1]);
        if (texts.length) parts.push(texts.join(" "));
      }
    }
    return parts.join("\n\n") || "[No readable PPTX content]";
  } catch {
    return "[PPTX extraction failed]";
  }
}

/** Determine if a file type can be sent as image_url (native AI support) */
function isNativeVisionType(fileType: string): boolean {
  const ft = fileType.toLowerCase();
  return ft.includes("pdf") || ft.includes("png") || ft.includes("jpg") ||
    ft.includes("jpeg") || ft.includes("webp") || ft.includes("image/");
}

/** Get proper media type for vision-supported files */
function getMediaType(fileType: string): string {
  const ft = fileType.toLowerCase();
  if (ft.includes("pdf")) return "application/pdf";
  if (ft.includes("png")) return "image/png";
  if (ft.includes("jpg") || ft.includes("jpeg")) return "image/jpeg";
  if (ft.includes("webp")) return "image/webp";
  return "application/octet-stream";
}

/** Check if file type is a document that needs text extraction */
function getDocType(fileType: string, fileName?: string): "docx" | "xlsx" | "pptx" | "txt" | "csv" | null {
  const ft = (fileType + " " + (fileName || "")).toLowerCase();
  if (ft.includes("docx") || ft.includes("doc") || ft.includes("wordprocessingml")) return "docx";
  if (ft.includes("xlsx") || ft.includes("xls") || ft.includes("spreadsheetml")) return "xlsx";
  if (ft.includes("pptx") || ft.includes("presentationml")) return "pptx";
  if (ft.includes("text/plain") || ft.includes(".txt")) return "txt";
  if (ft.includes("text/csv") || ft.includes(".csv")) return "csv";
  return null;
}

interface FileEntry {
  base64: string;
  type: string;
  name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, file_base64, file_type, files, url, model } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Always use Gemini for brief parsing (vision/file extraction) regardless of user's selected model
    const hasVisionContent = (files && Array.isArray(files) && files.length > 0) || (file_base64 && file_type);
    const aiModel = hasVisionContent ? "google/gemini-2.5-flash" : (model || "google/gemini-2.5-flash");
    const content: any[] = [];

    // Build file list (support both single legacy format and new multi-file format)
    const fileList: FileEntry[] = [];
    if (files && Array.isArray(files)) {
      fileList.push(...files);
    } else if (file_base64 && file_type) {
      fileList.push({ base64: file_base64, type: file_type, name: "" });
    }

    if (fileList.length > 0) {
      const extractedTexts: string[] = [];

      for (const file of fileList) {
        const docType = getDocType(file.type, file.name);

        if (docType === "docx") {
          const extracted = await extractDocxText(file.base64);
          extractedTexts.push(`--- File: ${file.name || "document.docx"} ---\n${extracted}`);
        } else if (docType === "xlsx") {
          const extracted = await extractXlsxText(file.base64);
          extractedTexts.push(`--- File: ${file.name || "spreadsheet.xlsx"} ---\n${extracted}`);
        } else if (docType === "pptx") {
          const extracted = await extractPptxText(file.base64);
          extractedTexts.push(`--- File: ${file.name || "presentation.pptx"} ---\n${extracted}`);
        } else if (docType === "txt" || docType === "csv") {
          try {
            const decoded = new TextDecoder().decode(b64ToUint8(file.base64));
            extractedTexts.push(`--- File: ${file.name || "file.txt"} ---\n${decoded}`);
          } catch {
            extractedTexts.push(`[Could not decode ${file.name}]`);
          }
        } else if (isNativeVisionType(file.type)) {
          // Images and PDFs: send as image_url (AI gateway supports these natively)
          const mediaType = getMediaType(file.type);
          content.push({
            type: "image_url",
            image_url: { url: `data:${mediaType};base64,${file.base64}` },
          });
        } else {
          // Unknown type: try DOCX extraction as fallback (many office docs are ZIP-based)
          try {
            const extracted = await extractDocxText(file.base64);
            if (extracted && !extracted.includes("[Could not extract") && !extracted.includes("[DOCX extraction failed]")) {
              extractedTexts.push(`--- File: ${file.name || "unknown"} ---\n${extracted}`);
            } else {
              extractedTexts.push(`[Unsupported file type: ${file.name || file.type}]`);
            }
          } catch {
            extractedTexts.push(`[Unsupported file type: ${file.name || file.type}]`);
          }
        }
      }

      // Combine extracted text content
      if (extractedTexts.length > 0) {
        content.unshift({
          type: "text",
          text: `Extract ALL text from the following document(s). Return the complete content preserving structure, headings, bullet points, and any marking criteria. If it's an assessment brief, identify: title, assessment type, word count requirement, learning outcomes, marking criteria, and any specific instructions.\n\n${extractedTexts.join("\n\n")}`,
        });
      } else {
        // Only vision files, add instruction
        content.unshift({
          type: "text",
          text: "Extract ALL text from this document. Return the complete content preserving structure, headings, bullet points, and any marking criteria. If it's an assessment brief, identify: title, assessment type, word count requirement, learning outcomes, marking criteria, and any specific instructions.",
        });
      }
    } else {
      const inputText = text || (url ? `Please extract the assessment brief from this URL: ${url}` : "");
      content.push({ type: "text", text: `Analyze this assessment brief and extract structured information:\n\n${inputText}` });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          {
            role: "system",
            content: `${getZoeIdentityHeader()} You are now parsing an assessment brief. Read it with the full depth of your understanding — extract every requirement, constraint, framework, and marking criterion. Extract structured information with complete accuracy. Always respond using the provided tool.`,
          },
          { role: "user", content },
        ],
        tools: [{
          type: "function",
          function: {
            name: "parse_brief",
            description: "Return structured brief data",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Assessment title" },
                type: { type: "string", description: "Assessment type (Essay, Report, Case Study, etc.)" },
                word_count: { type: "number", description: "Required word count" },
                subject: { type: "string", description: "Subject/module" },
                academic_level: { type: "string", description: "Academic level" },
                requirements: { type: "array", items: { type: "string" }, description: "Key requirements" },
                marking_criteria: { type: "array", items: { type: "object", properties: { criterion: { type: "string" }, weight: { type: "string" } }, required: ["criterion"] }, description: "Marking criteria" },
                learning_outcomes: { type: "array", items: { type: "string" }, description: "Learning outcomes" },
                raw_text: { type: "string", description: "Full extracted text" },
              },
              required: ["title", "type", "raw_text"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "parse_brief" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      console.error("AI gateway error details:", status, body);
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const parsed = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify({ success: true, brief: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("brief-parse error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
