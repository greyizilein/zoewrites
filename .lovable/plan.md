
## Goal

Redesign `/zoe` to look and feel like the ChatGPT interface in the reference screenshot, and add a "Chat theme" picker (10 colour options) in Settings.

## What changes

### 1. Layout overhaul — ChatGPT style (in `ZoeChat.tsx`, `mode === "page"` only)

**Persistent left sidebar** (always visible on desktop ≥ md, slide-over on mobile):
- Top: ZOE logo + "collapse" toggle
- "+ New chat" button
- "Search chats" row (icon + label, opens search input)
- Chat list grouped under a "Chats" label, each row = single line title, hover reveals delete
- Bottom: user avatar + email + "Upgrade" pill (existing footer, restyled)

**Main pane**:
- Slim top bar: workspace title ("ZOE") on the left, "Dashboard" link on the right (no separate header strip with "+" / trash — those move into the sidebar)
- Messages area centred with `max-w-3xl` column, generous vertical spacing
- **User message**: pill-shaped bubble in the active theme colour, right-aligned, no avatar (matches the green "testing" pill in the reference)
- **Assistant message**: full-width plain text, no avatar, no "ZOE" label above each turn, no bubble — just clean prose with markdown
- Hover row of small icons under each assistant message: copy, thumbs-up, thumbs-down, share, regenerate (we already have copy/.docx/.pdf/.txt — keep those, restyle as ghost icons)
- **Bottom composer**: fully rounded pill (`rounded-full`), centred, max-w-3xl, with "+" attach on the left and a coloured circular send button on the right. Placeholder: "Ask anything"
- Empty-state: large centred "Hi, I'm ZOE." + the same pill composer + quick-action chips below (already exists, restyle)

### 2. Chat theme system (10 colours)

**Storage**: `localStorage` key `zoe_theme_${uid}`, default `"emerald"`.

**Palette** (each defines: bubble bg, bubble text, send-button bg, accent for active sidebar item):
1. Emerald (default — matches reference green)
2. Terracotta (current brand)
3. Sky blue
4. Violet
5. Rose
6. Amber
7. Slate
8. Teal
9. Indigo
10. Pink

Implemented as a `THEMES` constant map → CSS variables `--zoe-accent`, `--zoe-accent-fg`, `--zoe-bubble`, `--zoe-bubble-fg` set on the root `<div data-zoe-mode="page">` via inline style. All themed elements use `bg-[var(--zoe-bubble)]` etc.

**Settings UI**: in the existing sidebar settings panel, add a new "Appearance" group above "Writing":
- Label: "Chat theme"
- 10 circular swatches in a 5×2 grid; clicking sets the theme; active swatch shows a ring

### 3. AMOLED stays

Background stays true black; sidebar uses `#0A0A0A`; borders `#1F1F1F`. Theme colour only affects user bubble, send button, and active-row accent — not the canvas — so the AMOLED feel is preserved.

### 4. Files touched

- `src/components/chat/ZoeChat.tsx` — layout restructure for `mode === "page"`, theme variables, swatch picker, message rendering tweaks
- `src/index.css` — small additions: `.zoe-amoled` user-bubble override removed (themed via CSS vars now), composer pill styles

`mode === "widget"` rendering is left untouched (it's no longer mounted anywhere after the previous change).

## Out of scope

- No new database tables (theme is a local preference, like the existing model/writing settings)
- No changes to edge functions or the silent-architect flow
- Mobile keeps a slide-over sidebar (toggled by a hamburger in the top bar) — not a permanent rail, since viewport is narrow
