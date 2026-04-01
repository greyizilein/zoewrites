import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Header, Footer, PageNumber, PageBreak, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, ImageRun } from "https://esm.sh/docx@8.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Parse inline markdown formatting into TextRun objects */
function parseInlineFormatting(text: string, font = "Calibri", size = 24): TextRun[] {
  const runs: TextRun[] = [];
  // Match **bold**, *italic*, ***bold+italic***
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      runs.push(new TextRun({ text: match[2], bold: true, italics: true, size, font }));
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], bold: true, size, font }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], italics: true, size, font }));
    } else if (match[5]) {
      runs.push(new TextRun({ text: match[5], size, font }));
    }
  }
  if (runs.length === 0) {
    runs.push(new TextRun({ text, size, font }));
  }
  return runs;
}

/** Parse a line of content and return appropriate paragraph(s).
 *  font: doc font (Calibri default), lineSpacing: 480=double, 360=1.5x
 */
function parseContentLine(line: string, font = "Calibri", lineSpacing = 480): Paragraph | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // H4: #### heading
  const h4Match = trimmed.match(/^####\s+(.+)$/);
  if (h4Match) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_4,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: h4Match[1].replace(/\*+/g, ""), bold: true, italics: true, size: 24, font })],
    });
  }
  // H3: ###
  const h3Match = trimmed.match(/^###\s+(.+)$/);
  if (h3Match) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 280, after: 160 },
      children: [new TextRun({ text: h3Match[1].replace(/\*+/g, ""), bold: true, size: 26, font })],
    });
  }
  // H2: ##
  const h2Match = trimmed.match(/^##\s+(.+)$/);
  if (h2Match) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 360, after: 200 },
      children: [new TextRun({ text: h2Match[1].replace(/\*+/g, ""), bold: true, size: 32, font })],
    });
  }
  // H1: #
  const h1Match = trimmed.match(/^#\s+(.+)$/);
  if (h1Match) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 480, after: 360 },
      children: [new TextRun({ text: h1Match[1].replace(/\*+/g, ""), bold: true, size: 40, font })],
    });
  }

  // Block quotation: > text
  const blockQuoteMatch = trimmed.match(/^>\s+(.+)$/);
  if (blockQuoteMatch) {
    return new Paragraph({
      spacing: { before: 240, after: 240, line: 360 },
      alignment: AlignmentType.JUSTIFIED,
      indent: { left: 567, right: 567 },
      children: parseInlineFormatting(blockQuoteMatch[1], font, 22),
    });
  }

  // Figure caption: "Figure N:" or "Fig. N:"
  const figCapMatch = trimmed.match(/^(Figure|Fig\.)\s+\d+[:.]/i);
  if (figCapMatch) {
    return new Paragraph({
      spacing: { before: 120, after: 240, line: 240 },
      alignment: AlignmentType.CENTER,
      children: parseInlineFormatting(trimmed.replace(/\*+/g, ""), font, 20),
    });
  }

  // Table caption: "Table N:"
  const tableCapMatch = trimmed.match(/^Table\s+\d+[:.]/i);
  if (tableCapMatch) {
    return new Paragraph({
      spacing: { before: 240, after: 120, line: 240 },
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: trimmed.replace(/\*+/g, ""), bold: true, size: 20, font })],
    });
  }

  // Bullet list: - item or * item
  const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
  if (bulletMatch) {
    return new Paragraph({
      spacing: { after: 80 },
      indent: { left: 720, hanging: 360 },
      children: [new TextRun({ text: "• ", size: 24, font }), ...parseInlineFormatting(bulletMatch[1], font)],
    });
  }

  // Numbered list: 1. item
  const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
  if (numMatch) {
    return new Paragraph({
      spacing: { after: 80 },
      indent: { left: 720, hanging: 360 },
      children: [new TextRun({ text: `${numMatch[1]}. `, size: 24, font }), ...parseInlineFormatting(numMatch[2], font)],
    });
  }

  // [FIGURE X: ...] placeholder line
  const figPlaceholder = trimmed.match(/^\[FIGURE\s+\d+:/i);
  if (figPlaceholder) {
    return new Paragraph({
      spacing: { before: 120, after: 120, line: 240 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: trimmed, size: 20, font, italics: true, color: "888888" })],
    });
  }

  // Regular body paragraph — double line spacing, justified
  return new Paragraph({
    spacing: { after: 240, line: lineSpacing },
    alignment: AlignmentType.JUSTIFIED,
    children: parseInlineFormatting(trimmed, font),
  });
}

/** Parse markdown tables from content */
function parseMarkdownTables(text: string): (string | { type: "table"; rows: string[][] })[] {
  const parts: (string | { type: "table"; rows: string[][] })[] = [];
  const lines = text.split("\n");
  let i = 0;
  let currentText = "";

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      if (currentText.trim()) { parts.push(currentText.trim()); currentText = ""; }
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        const row = lines[i].trim().slice(1, -1).split("|").map(c => c.trim());
        if (!row.every(c => /^[-:]+$/.test(c))) {
          tableRows.push(row);
        }
        i++;
      }
      if (tableRows.length > 0) parts.push({ type: "table", rows: tableRows });
    } else {
      currentText += line + "\n";
      i++;
    }
  }
  if (currentText.trim()) parts.push(currentText.trim());
  return parts;
}

function buildDocxTable(rows: string[][], font = "Calibri"): Table {
  const colCount = Math.max(...rows.map(r => r.length));
  const tableWidth = 9026;
  const colWidth = Math.floor(tableWidth / colCount);
  const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

  return new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: Array(colCount).fill(colWidth),
    rows: rows.map((row, ri) =>
      new TableRow({
        children: Array.from({ length: colCount }, (_, ci) =>
          new TableCell({
            borders: cellBorders,
            width: { size: colWidth, type: WidthType.DXA },
            shading: ri === 0 ? { fill: "E8E7E4", type: ShadingType.CLEAR } : undefined,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({
              children: parseInlineFormatting(row[ci] || "", font),
            })],
          })
        ),
      })
    ),
  });
}

function extractCitations(content: string): string[] {
  const citations = new Set<string>();
  const patterns = [
    /\(([A-Z][a-zA-Z'-]+(?:\s+(?:and|&)\s+[A-Z][a-zA-Z'-]+)?(?:\s+et\s+al\.?)?,?\s*\d{4}[a-z]?)\)/g,
    /\(([A-Z][a-zA-Z'-]+(?:\s+(?:and|&)\s+[A-Z][a-zA-Z'-]+)?(?:\s+et\s+al\.?)?,?\s*\d{4}[a-z]?(?:;\s*[A-Z][a-zA-Z'-]+(?:\s+(?:and|&)\s+[A-Z][a-zA-Z'-]+)?(?:\s+et\s+al\.?)?,?\s*\d{4}[a-z]?)*)\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const parts = match[1].split(";").map(s => s.trim());
      for (const p of parts) { if (p) citations.add(p); }
    }
  }
  return Array.from(citations).sort();
}

function uint8ToBase64(uint8: Uint8Array): string {
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < uint8.length; i += chunkSize) {
    const chunk = uint8.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { assessment_id, prefer_inline, submission_details, font: fontParam } = await req.json();
    if (!assessment_id) throw new Error("Missing assessment_id");

    // Parse font parameter
    const fontParts = (fontParam || "Calibri 12pt").split(" ");
    const docFont = fontParts[0] || "Calibri";
    const docFontSize = parseInt(fontParts[1]) || 12;
    const docFontSizePt = docFontSize * 2; // half-points

    const authHeader = req.headers.get("authorization");
    const apiKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userId: string;
    if (authHeader && authHeader !== `Bearer ${apiKey}`) {
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        apiKey,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error: userErr } = await anonClient.auth.getUser();
      if (userErr || !user) throw new Error("Unauthorized");
      userId = user.id;
    } else {
      throw new Error("Missing authorization header");
    }

    console.log(`[export-docx] Starting for assessment=${assessment_id}, user=${userId}`);

    const { data: assessment, error: aErr } = await supabase
      .from("assessments").select("*").eq("id", assessment_id).single();
    if (aErr || !assessment) throw new Error("Assessment not found");
    if (assessment.user_id !== userId) throw new Error("Forbidden");

    // Determine line spacing and TOC depth from assessment settings
    const lang = (assessment.settings as any)?.language || "UK English";
    const bodyLineSpacing = lang.toLowerCase().includes("us") ? 360 : 480;
    const level = (assessment.settings as any)?.level || "";
    const tocIncludeH3 = /masters|postgraduate|l7|doctoral|phd/i.test(level);
    const citStyle = (assessment.settings as any)?.citationStyle || "Harvard";
    const isNumericCitStyle = /vancouver|ieee/i.test(citStyle);

    const { data: sections, error: sErr } = await supabase
      .from("sections").select("*").eq("assessment_id", assessment_id).order("sort_order", { ascending: true });
    if (sErr) throw sErr;

    // Fetch images for all sections
    const sectionIds = (sections || []).map(s => s.id);
    let images: any[] = [];
    if (sectionIds.length > 0) {
      const { data: imgData } = await supabase
        .from("assessment_images").select("*").in("section_id", sectionIds).order("figure_number", { ascending: true });
      images = imgData || [];
    }

    const safeTitle = (assessment.title || "Assessment").replace(/[^a-zA-Z0-9\s-_]/g, "").replace(/\s+/g, "_");
    const filename = `${safeTitle}_FINAL.docx`;

    // Build title page with submission details
    const sd = submission_details || {};
    const titlePageChildren = [
      new Paragraph({ spacing: { before: 4000 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: assessment.title, bold: true, size: 52, font: docFont })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: assessment.type || "Assessment", size: 28, font: docFont, color: "666666" })],
      }),
    ];
    // Add submission details to title page
    const detailLines = [
      sd.fullName && `By: ${sd.fullName}`,
      sd.studentId && `Student ID: ${sd.studentId}`,
      sd.institution,
      sd.moduleName && sd.moduleCode ? `${sd.moduleName} (${sd.moduleCode})` : sd.moduleName || sd.moduleCode,
      sd.supervisor && `Supervisor: ${sd.supervisor}`,
      sd.academicYear && `Academic Year: ${sd.academicYear}`,
      sd.company && `Organisation: ${sd.company}`,
      sd.submissionDate ? new Date(sd.submissionDate).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }) : new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }),
    ].filter(Boolean);
    for (const line of detailLines) {
      titlePageChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({ text: line as string, size: 24, font: docFont, color: "555555" })],
      }));
    }
    titlePageChildren.push(new Paragraph({ children: [new PageBreak()] }));

    // Collect figures and tables from all sections for List of Figures/Tables
    const allFigures: { secNum: number; num: number; caption: string }[] = [];
    const allTables: { secNum: number; num: number; caption: string }[] = [];
    let figGlobal = 0, tableGlobal = 0;
    let scanSecNum = 0;
    for (const sec of (sections || [])) {
      scanSecNum++;
      if (!sec.content) continue;
      const lines = sec.content.split("\n");
      for (const line of lines) {
        const t = line.trim();
        const fcap = t.match(/^(Figure|Fig\.)\s+(\d+)[:.]\s*(.*)$/i);
        if (fcap) { figGlobal++; allFigures.push({ secNum: scanSecNum, num: figGlobal, caption: fcap[3] || t }); }
        const tcap = t.match(/^Table\s+(\d+)[:.]\s*(.*)$/i);
        if (tcap) { tableGlobal++; allTables.push({ secNum: scanSecNum, num: tableGlobal, caption: tcap[2] || t }); }
      }
    }
    // Add images from DB to figure list
    for (const img of images) {
      if (img.caption) { figGlobal++; allFigures.push({ secNum: 0, num: figGlobal, caption: img.caption }); }
    }

    // Build manual TOC from sections (reliable across all viewers, no Word field dependency)
    const tocEntries: any[] = [];
    tocEntries.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 0, after: 300 },
        children: [new TextRun({ text: "Table of Contents", bold: true, size: 40, font: docFont })],
      })
    );
    let sectionNum = 0;
    for (const sec of (sections || [])) {
      sectionNum++;
      tocEntries.push(
        new Paragraph({
          spacing: { after: 80 },
          tabStops: [{ type: "right" as any, position: 9000, leader: "dot" as any }],
          children: [new TextRun({ text: `${sectionNum}.  ${sec.title}`, size: 22, font: docFont, bold: true })],
        })
      );
      // H2 sub-headings
      if (sec.content) {
        const h2Lines = sec.content.split("\n").filter((l: string) => /^##\s/.test(l.trim()));
        let subNum = 0;
        for (const sh of h2Lines) {
          subNum++;
          const subTitle = sh.replace(/^##\s+/, "").replace(/\*+/g, "").trim();
          tocEntries.push(
            new Paragraph({
              spacing: { after: 60 },
              indent: { left: 360 },
              tabStops: [{ type: "right" as any, position: 8640, leader: "dot" as any }],
              children: [new TextRun({ text: `${sectionNum}.${subNum}  ${subTitle}`, size: 20, font: docFont, color: "333333" })],
            })
          );
          // H3 included for Masters/PhD per spec
          if (tocIncludeH3) {
            const h3Lines = sec.content.split("\n").filter((l: string) => /^###\s/.test(l.trim()));
            let sub3Num = 0;
            for (const s3 of h3Lines) {
              sub3Num++;
              const sub3Title = s3.replace(/^###\s+/, "").replace(/\*+/g, "").trim();
              tocEntries.push(
                new Paragraph({
                  spacing: { after: 40 },
                  indent: { left: 720 },
                  tabStops: [{ type: "right" as any, position: 8280, leader: "dot" as any }],
                  children: [new TextRun({ text: `${sectionNum}.${subNum}.${sub3Num}  ${sub3Title}`, size: 18, font: docFont, color: "555555" })],
                })
              );
            }
          }
        }
      }
    }
    // References entry
    if ((sections || []).some((s: any) => s.content)) {
      tocEntries.push(
        new Paragraph({
          spacing: { after: 80, before: 80 },
          tabStops: [{ type: "right" as any, position: 9000, leader: "dot" as any }],
          children: [new TextRun({ text: "References", size: 22, font: docFont, bold: true })],
        })
      );
    }
    tocEntries.push(new Paragraph({ children: [new PageBreak()] }));

    // List of Figures (if any)
    if (allFigures.length > 0) {
      tocEntries.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: "List of Figures", bold: true, size: 32, font: docFont })],
        })
      );
      for (const fig of allFigures) {
        tocEntries.push(new Paragraph({
          spacing: { after: 80 },
          tabStops: [{ type: "right" as any, position: 9000, leader: "dot" as any }],
          children: [new TextRun({ text: `Figure ${fig.num}: ${fig.caption}`, size: 20, font: docFont })],
        }));
      }
      tocEntries.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
    }

    // List of Tables (if any)
    if (allTables.length > 0) {
      tocEntries.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: "List of Tables", bold: true, size: 32, font: docFont })],
        })
      );
      for (const tbl of allTables) {
        tocEntries.push(new Paragraph({
          spacing: { after: 80 },
          tabStops: [{ type: "right" as any, position: 9000, leader: "dot" as any }],
          children: [new TextRun({ text: `Table ${tbl.num}: ${tbl.caption}`, size: 20, font: docFont })],
        }));
      }
      tocEntries.push(new Paragraph({ children: [new PageBreak()] }));
    } else if (allFigures.length > 0) {
      tocEntries.push(new Paragraph({ children: [new PageBreak()] }));
    }

    const tocChildren = tocEntries;

    // Section content with proper markdown parsing
    const sectionChildren: any[] = [];
    const allCitations: string[] = [];
    let bodySecNum = 0;

    for (const section of (sections || [])) {
      bodySecNum++;
      // H1 chapter title: 20pt Bold, new page via page break before (except first)
      if (bodySecNum > 1) {
        sectionChildren.push(new Paragraph({ children: [new PageBreak()] }));
      }
      sectionChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: `${bodySecNum}. ${section.title}`, bold: true, size: 40, font: docFont })],
        })
      );

      if (section.content) {
        const sectionCites = extractCitations(section.content);
        for (const c of sectionCites) { if (!allCitations.includes(c)) allCitations.push(c); }

        let h2Count = 0;
        let h3Count = 0;
        let h4Count = 0;

        const parts = parseMarkdownTables(section.content);
        for (const part of parts) {
          if (typeof part === "string") {
            const lines = part.split("\n");
            for (const line of lines) {
              const trimmed = line.trim();
              // H4: #### (12pt Bold Italic)
              const h4Match = trimmed.match(/^####\s+(.+)$/);
              if (h4Match) {
                h4Count++;
                const numberedTitle = `${bodySecNum}.${h2Count || 1}.${h3Count || 1}.${h4Count} ${h4Match[1].replace(/\*+/g, "")}`;
                sectionChildren.push(new Paragraph({
                  heading: HeadingLevel.HEADING_4,
                  spacing: { before: 240, after: 120 },
                  children: [new TextRun({ text: numberedTitle, bold: true, italics: true, size: 24, font: docFont })],
                }));
                continue;
              }
              // H3: ### (13pt Bold)
              const h3Match = trimmed.match(/^###\s+(.+)$/);
              if (h3Match) {
                h3Count++;
                h4Count = 0;
                const numberedTitle = `${bodySecNum}.${h2Count || 1}.${h3Count} ${h3Match[1].replace(/\*+/g, "")}`;
                sectionChildren.push(new Paragraph({
                  heading: HeadingLevel.HEADING_3,
                  spacing: { before: 280, after: 160 },
                  children: [new TextRun({ text: numberedTitle, bold: true, size: 26, font: docFont })],
                }));
                continue;
              }
              // H2: ## (16pt Bold)
              const h2Match = trimmed.match(/^##\s+(.+)$/);
              if (h2Match) {
                h2Count++;
                h3Count = 0;
                h4Count = 0;
                const numberedTitle = `${bodySecNum}.${h2Count} ${h2Match[1].replace(/\*+/g, "")}`;
                sectionChildren.push(new Paragraph({
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 360, after: 200 },
                  children: [new TextRun({ text: numberedTitle, bold: true, size: 32, font: docFont })],
                }));
                continue;
              }
              const para = parseContentLine(line, docFont, bodyLineSpacing);
              if (para) sectionChildren.push(para);
            }
          } else {
            sectionChildren.push(buildDocxTable(part.rows, docFont));
            sectionChildren.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
          }
        }
      }

      // Embed images for this section
      const sectionImages = images.filter(img => img.section_id === section.id);
      for (const img of sectionImages) {
        if (img.url) {
          try {
            let imgData: Uint8Array;
            let imgType: "png" | "jpg" = "png";

            if (img.url.startsWith("data:")) {
              const [header, b64] = img.url.split(",");
              imgType = header.includes("jpeg") || header.includes("jpg") ? "jpg" : "png";
              const binaryStr = atob(b64);
              imgData = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) imgData[i] = binaryStr.charCodeAt(i);
            } else {
              const resp = await fetch(img.url);
              if (!resp.ok) continue;
              const contentType = resp.headers.get("content-type") || "";
              imgType = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
              imgData = new Uint8Array(await resp.arrayBuffer());
            }

            // Add image centered
            sectionChildren.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 100 },
              children: [new ImageRun({
                data: imgData,
                transformation: { width: 450, height: 300 },
                altText: { title: img.caption || "Figure", description: img.caption || "Assessment figure", name: `figure_${img.figure_number || ""}` },
              })],
            }));

            // Figure caption below — 10pt Italic, centred
            sectionChildren.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 240, line: 240 },
              children: [new TextRun({
                text: `Figure ${img.figure_number || ""}: ${img.caption || ""}`.trim(),
                size: 20, font: docFont, italics: true, color: "555555",
              })],
            }));
          } catch (e) {
            console.error(`[export-docx] Failed to embed image ${img.id}:`, e);
          }
        }
      }

      if (section.citations && Array.isArray(section.citations)) {
        for (const cite of section.citations) {
          const citeText = typeof cite === "string" ? cite : cite?.text;
          if (citeText && !allCitations.includes(citeText)) allCitations.push(citeText);
        }
      }
    }

    // Generate reference list from ## References blocks in section content (preferred)
    // or fall back to AI generation from in-text citations
    let referenceEntries: string[] = [];

    // First: extract ## References sections already written in each section's content
    const extractedRefs = new Set<string>();
    for (const sec of (sections || [])) {
      if (!sec.content) continue;
      const refIdx = sec.content.indexOf("## References");
      if (refIdx !== -1) {
        const refBlock = sec.content.slice(refIdx + 14).trim();
        for (const line of refBlock.split("\n")) {
          const t = line.trim();
          if (t.length > 15 && !t.startsWith("#")) extractedRefs.add(t);
        }
      }
    }
    if (extractedRefs.size > 0) {
      referenceEntries = Array.from(extractedRefs);
    }

    // Fallback: generate from in-text citations via AI
    if (referenceEntries.length === 0 && allCitations.length > 0) {
      try {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          const etAlRule = /harvard|apa/i.test(citStyle)
            ? "Et al. threshold: use 'et al.' for 3+ authors in-text; list ALL authors in the reference list."
            : /mla/i.test(citStyle)
            ? "Et al. threshold: use 'et al.' for 4+ authors in-text; list ALL authors in the reference list."
            : "List all authors in the reference list.";
          const orderRule = isNumericCitStyle
            ? "Order entries sequentially by citation number (1, 2, 3...) — do NOT sort alphabetically."
            : "Order entries alphabetically by first author surname.";
          const refResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: `Generate a complete ${citStyle} reference list. Return ONLY the reference entries, one per line, no numbering prefix unless the style requires it (Vancouver/IEEE use numbers). Format strictly in ${citStyle} style. ${orderRule} ${etAlRule} DOI/URLs must appear where relevant. Use "and" not "&" for Harvard. For APA 7th: include DOI as hyperlink text. All entries must be genuine and verifiable.` },
                { role: "user", content: `In-text citations:\n${allCitations.join("\n")}` },
              ],
            }),
          });
          if (refResp.ok) {
            const refData = await refResp.json();
            const refContent = refData.choices?.[0]?.message?.content || "";
            referenceEntries = refContent.split("\n").filter((l: string) => l.trim().length > 10);
          }
        }
      } catch (e) {
        console.error("[export-docx] Reference generation failed:", e);
      }
      if (referenceEntries.length === 0) referenceEntries = allCitations;
    }

    if (referenceEntries.length > 0) {
      sectionChildren.push(new Paragraph({ children: [new PageBreak()] }));
      // References heading: H1 style, CENTRED, no chapter number (per spec)
      sectionChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "References", bold: true, size: 40, font: docFont })],
        })
      );
      // Sort: alphabetical for author-date styles; preserve order for Vancouver/IEEE
      const sortedRefs = isNumericCitStyle ? referenceEntries : [...referenceEntries].sort((a, b) => a.localeCompare(b));
      // Reference list entry: 11pt, 1.5× within entries, 6pt(120 twips) between entries, hanging 10mm(567)
      for (const ref of sortedRefs) {
        if (!ref.trim()) continue;
        sectionChildren.push(
          new Paragraph({
            spacing: { after: 120, line: 360 },
            alignment: AlignmentType.JUSTIFIED,
            indent: { left: 567, hanging: 567 },
            children: parseInlineFormatting(ref, docFont, 22),
          })
        );
      }
    }

    const doc = new Document({
      styles: {
        default: { document: { run: { font: docFont, size: docFontSizePt } } },
        paragraphStyles: [
          // H1/Chapter: 20pt Bold, Before: 24pt(480), After: 18pt(360)
          { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 40, bold: true, font: docFont },
            paragraph: { spacing: { before: 480, after: 360 }, outlineLevel: 0 } },
          // H2/Major section: 16pt Bold, Before: 18pt(360), After: 10pt(200)
          { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 32, bold: true, font: docFont },
            paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 1 } },
          // H3/Sub-section: 13pt Bold, Before: 14pt(280), After: 8pt(160)
          { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 26, bold: true, font: docFont },
            paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 2 } },
          // H4/Paragraph heading: 12pt Bold Italic, Before: 12pt(240), After: 6pt(120)
          { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 24, bold: true, italics: true, font: docFont },
            paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 3 } },
        ]
      },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: assessment.title, size: 20, font: docFont, color: "999999" })],
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "Page ", size: 20, font: docFont, color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], size: 20, font: docFont, color: "999999" })],
            })],
          }),
        },
        children: [...titlePageChildren, ...tocChildren, ...sectionChildren],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const uint8 = new Uint8Array(buffer);
    console.log(`[export-docx] Document generated: ${uint8.length} bytes`);

    const base64 = uint8ToBase64(uint8);
    const mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    let signedUrl: string | null = null;
    if (!prefer_inline) {
      try {
        const storagePath = `${userId}/${assessment_id}/${Date.now()}.docx`;
        const { error: uploadErr } = await supabase.storage
          .from("exports").upload(storagePath, buffer, { contentType: mime });
        if (uploadErr) {
          console.error("[export-docx] Upload error:", uploadErr.message);
        } else {
          const { data: urlData, error: urlErr } = await supabase.storage
            .from("exports").createSignedUrl(storagePath, 3600);
          if (urlErr) console.error("[export-docx] SignedUrl error:", urlErr.message);
          else signedUrl = urlData?.signedUrl || null;
        }
      } catch (e) {
        console.error("[export-docx] Storage error:", e);
      }
    }

    try {
      await supabase.from("exports").insert({ assessment_id, format: "docx", url: signedUrl });
    } catch (e) {
      console.error("[export-docx] Export record insert error:", e);
    }

    const download = signedUrl
      ? { type: "url" as const, url: signedUrl, filename }
      : { type: "base64" as const, base64, filename, mime };

    return new Response(JSON.stringify({
      success: true, download,
      url: signedUrl, base64: signedUrl ? undefined : base64, filename,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("export-docx error:", e);
    return new Response(JSON.stringify({
      success: false, error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
