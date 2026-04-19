/**
 * Multi-format export helpers — .txt, .docx, .pdf
 *
 * Used by ZOE chat to download generated content in the user's preferred format.
 * Markdown is parsed to a lightweight AST so the docx and pdf outputs preserve
 * basic structure (headings, paragraphs, simple tables).
 */
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import jsPDF from "jspdf";

// Strip ZOE-internal markers (e.g. architect table marker) before exporting.
const MARKERS = ["<!--ZOE_ARCHITECT_TABLE-->", "<!--ZOE_SECTION_OUTPUT-->"];

function clean(text: string): string {
  let out = text;
  for (const m of MARKERS) out = out.split(m).join("");
  return out.trim();
}

// ── Plain text ────────────────────────────────────────────────────────────────
export function exportTxt(text: string, filename = "zoe-output.txt") {
  const blob = new Blob([clean(text)], { type: "text/plain;charset=utf-8" });
  triggerDownload(blob, filename);
}

// ── DOCX ──────────────────────────────────────────────────────────────────────
export async function exportDocx(text: string, filename = "zoe-output.docx") {
  const cleaned = clean(text);
  const blocks = parseBlocks(cleaned);

  const children: (Paragraph | Table)[] = [];

  for (const block of blocks) {
    if (block.kind === "heading") {
      const level =
        block.level === 1 ? HeadingLevel.HEADING_1 :
        block.level === 2 ? HeadingLevel.HEADING_2 :
        block.level === 3 ? HeadingLevel.HEADING_3 :
        HeadingLevel.HEADING_4;
      children.push(new Paragraph({
        text: block.text,
        heading: level,
        spacing: { before: 240, after: 120 },
      }));
    } else if (block.kind === "table") {
      const rows = block.rows.map((cells, rowIdx) => new TableRow({
        children: cells.map(cell => new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: cell, bold: rowIdx === 0 })],
          })],
          width: { size: Math.floor(10000 / cells.length), type: WidthType.DXA },
        })),
      }));
      children.push(new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }));
      children.push(new Paragraph({ text: "" }));
    } else {
      children.push(new Paragraph({
        children: parseInline(block.text),
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 160 },
      }));
    }
  }

  if (children.length === 0) {
    children.push(new Paragraph({ text: cleaned }));
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, filename);
}

// ── PDF ───────────────────────────────────────────────────────────────────────
export function exportPdf(text: string, filename = "zoe-output.pdf") {
  const cleaned = clean(text);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const blocks = parseBlocks(cleaned);

  const writeWrapped = (content: string, fontSize: number, bold: boolean) => {
    doc.setFont("times", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    const lineHeight = fontSize * 1.35;
    const lines = doc.splitTextToSize(content, maxWidth);
    for (const line of lines) {
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += fontSize * 0.4;
  };

  for (const block of blocks) {
    if (block.kind === "heading") {
      const size = block.level === 1 ? 18 : block.level === 2 ? 15 : 13;
      writeWrapped(block.text, size, true);
    } else if (block.kind === "table") {
      // Render tables as plain pipe-delimited text in PDF (simple & legible).
      for (const row of block.rows) {
        writeWrapped(row.join("  |  "), 10, false);
      }
      y += 6;
    } else {
      // Strip simple markdown emphasis for PDF
      const plain = block.text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
      writeWrapped(plain, 11, false);
    }
  }

  doc.save(filename);
}

// ── Markdown parsing (lightweight) ────────────────────────────────────────────
type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "table"; rows: string[][] }
  | { kind: "paragraph"; text: string };

function parseBlocks(md: string): Block[] {
  const lines = md.split(/\r?\n/);
  const blocks: Block[] = [];
  let buf: string[] = [];
  let tableBuf: string[] = [];

  const flushPara = () => {
    const text = buf.join(" ").trim();
    if (text) blocks.push({ kind: "paragraph", text });
    buf = [];
  };
  const flushTable = () => {
    if (tableBuf.length === 0) return;
    const rows = tableBuf
      .map(l => l.trim())
      .filter(l => !/^\|?\s*[:\-\s|]+\|?\s*$/.test(l)) // drop alignment row
      .map(l => l.replace(/^\||\|$/g, "").split("|").map(c => c.trim()));
    if (rows.length) blocks.push({ kind: "table", rows });
    tableBuf = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (line.startsWith("|") && line.includes("|")) {
      flushPara();
      tableBuf.push(line);
      continue;
    } else if (tableBuf.length) {
      flushTable();
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushPara();
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2].trim() });
      continue;
    }

    if (line.trim() === "") {
      flushPara();
      continue;
    }
    buf.push(line);
  }
  flushTable();
  flushPara();
  return blocks;
}

function parseInline(text: string): TextRun[] {
  // Very small inline parser: **bold** and *italic*. Falls back to plain run.
  const parts: TextRun[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(new TextRun(text.slice(last, m.index)));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(new TextRun({ text: token.slice(2, -2), bold: true }));
    } else {
      parts.push(new TextRun({ text: token.slice(1, -1), italics: true }));
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(new TextRun(text.slice(last)));
  if (parts.length === 0) parts.push(new TextRun(text));
  return parts;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
