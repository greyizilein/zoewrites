

# Export Verification + Dashboard Recent Assessments Widget

## Export-docx Verification (Already Correct)

The `export-docx/index.ts` is properly configured:
- **Justified text**: Line 102 — `alignment: AlignmentType.JUSTIFIED` on all body paragraphs
- **Heading hierarchy**: H1/H2/H3 styles with `outlineLevel: 0/1/2` (lines 436-444) and `parseContentLine` handles `#`, `##`, `###` markdown
- **Table of Contents**: Line 288 — `headingStyleRange: "1-3"` with hyperlinks
- **Submission details**: Lines 249-280 — title page includes name, student ID, institution, module, supervisor, date, company
- **Font selection**: Lines 198-201 — accepts font parameter and applies it throughout

No changes needed to the export function.

## Dashboard Widget: Recent Assessments Summary

Add a "Recent Activity" widget between the word budget bar and the assessment grid that shows:
- Last 5 assessments in a compact table/list format
- Status badge (coloured dot + label)
- Word count progress (current/target)
- Completion percentage
- Last updated timestamp
- Quick-link to open each assessment

### File to Change

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Add a "Recent Activity" summary widget after the word budget bar (line 209), showing the 5 most recent assessments in a compact card with status dots, word counts, and progress bars |

### Widget Design

A single card with a mini table:
```
Recent Activity
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
● Strategic Mgmt Report    1,245/2,500  50%  2h ago
● Marketing Analysis       890/1,000    89%  1d ago  
✓ Ethics Essay             1,500/1,500  100% 3d ago
```

- Coloured dot: terracotta (active), sage (complete)
- Clicking a row navigates to the assessment
- Shows up to 5 entries
- Below the word budget bar, above the full card grid

