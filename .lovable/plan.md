

## Goal

Extend the existing 10-colour accent picker so the user can also switch the **whole canvas** between AMOLED black, pure white, and a few full-interface themes — not just the bubble/send-button colour.

## What changes

### 1. Two independent controls in Settings → Appearance

**Control A — "Interface theme"** (new): switches the whole canvas
- AMOLED Black (current default — `#000` bg, white text, `#0A0A0A` sidebar)
- Pure White (white bg, black text, `#F7F7F7` sidebar, `#E5E5E5` borders)
- Soft Cream (matches the rest of the app — `#FAF8F4` bg, charcoal text)
- Midnight Navy (`#0B1220` bg, white text, blue-tinted sidebar)
- Graphite (`#1A1A1A` bg, white text — softer than AMOLED)

**Control B — "Accent colour"** (existing 10 swatches, kept as-is): only changes user bubble + send button + active-row highlight.

The two are orthogonal — e.g. user can have Pure White interface + Emerald accent, or AMOLED + Rose accent.

### 2. Implementation

In `src/components/chat/ZoeChat.tsx` (`mode === "page"` only):

- Add `INTERFACE_THEMES` map → each entry defines: `bg`, `fg`, `sidebar`, `sidebarFg`, `border`, `mutedFg`, `bubbleAssistantBg` (a faint surface for assistant prose hover, etc.)
- Persist to `localStorage` key `zoe_interface_${uid}`, default `"amoled"`
- Apply via CSS variables on the root `<div>`: `--zoe-bg`, `--zoe-fg`, `--zoe-sidebar`, `--zoe-sidebar-fg`, `--zoe-border`, `--zoe-muted-fg`
- Replace hardcoded `bg-black`, `text-white`, `bg-[#0A0A0A]`, `border-[#1F1F1F]` etc. inside the page-mode tree with `bg-[var(--zoe-bg)]`, `text-[var(--zoe-fg)]`, etc.
- Keep the `zoe-amoled` class **only when** the active interface theme is AMOLED — so the existing CSS overrides in `src/index.css` still apply for that mode and don't bleed into Pure White / Cream

In `src/index.css`:
- No new rules needed; the AMOLED block already keys off `.zoe-amoled` so simply not adding that class for light themes will deactivate it
- Add a tiny prose colour adjustment for Pure White/Cream (`.zoe-light .prose { color: #1a1a1a }`) so markdown stays readable on light backgrounds

### 3. Settings panel UI

Inside the existing Settings drawer (sidebar), add an **"Appearance"** section above the existing accent picker:

```text
Appearance
├── Interface theme
│   [AMOLED] [White] [Cream] [Navy] [Graphite]   ← row of labelled swatches
└── Accent colour
    [10 circular swatches in 5×2 grid]            ← already exists, untouched
```

Each interface-theme swatch shows the actual bg colour with a contrasting border + label below; active one gets a ring in the current accent colour.

### 4. Out of scope

- No DB changes — both prefs stay in `localStorage` like the existing accent
- The widget mode (unmounted everywhere now) is left alone
- The marketing site / dashboard themes are not affected — this is `/zoe`-only
- No new dependencies

### 5. Files touched

- `src/components/chat/ZoeChat.tsx` — add `INTERFACE_THEMES`, the second picker, swap hardcoded colours for CSS vars, conditionally apply `zoe-amoled` class
- `src/index.css` — small `.zoe-light .prose` colour rule so markdown reads correctly on light interfaces

