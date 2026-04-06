

# Build ZOE Floating Chat Widget for Dashboard

## Overview

Create a polished, floating AI chat assistant widget on the dashboard — a circular FAB in the bottom-right that opens a clean, minimal chat panel. ZOE has full executive control over the app (assessments, subscriptions, exports, navigation, etc.) via the existing `zoe-chat` edge function. No separate dashboard needed.

## Architecture

```text
Dashboard.tsx
  └── ZoeFloatingChat.tsx  (FAB + slide-up panel)
        ├── Chat header (ZOE name + × close)
        ├── Scrollable message area
        │     ├── Welcome empty state
        │     ├── User bubbles (right, solid terracotta)
        │     └── ZOE bubbles (left, light grey)
        ├── Inline tool result cards (charts, sources, etc.)
        └── Input bar (auto-expand textarea + send arrow)
```

## New Files

| File | Purpose |
|------|---------|
| `src/components/chat/ZoeFloatingChat.tsx` | Self-contained floating chat widget — FAB button, animated panel, message rendering with markdown, input bar, tool execution, file uploads |

## Modified Files

| File | Change |
|------|---------|
| `src/pages/Dashboard.tsx` | Import and render `<ZoeFloatingChat />` at page bottom |

## Component Details: `ZoeFloatingChat.tsx`

### UI Structure
- **FAB**: 56px circle, terracotta bg, bottom-right (bottom: 80px on mobile to clear nav bar, 24px on desktop), ZOE sparkle icon, pulse animation when idle
- **Panel**: Opens upward from FAB position. Mobile: full-screen overlay. Desktop: 400px wide × 600px tall card with rounded corners and shadow
- **Header**: Rounded top, terracotta gradient, "ZOE" name + "AI Assistant" subtitle, × close button
- **Messages**: Scrollable area. User messages right-aligned with terracotta bg. ZOE messages left-aligned with `bg-muted/50`. Markdown rendered via `react-markdown`
- **Empty state**: Centred sparkle icon + "Hey {name}, what do you have in mind?" with 3 suggestion chips (New Assessment, Check My Stats, Upgrade Plan)
- **Input bar**: Auto-expanding textarea (1-4 rows), paperclip for file attach, arrow send button (terracotta, appears when text entered), Enter to send (Shift+Enter for newline)
- **Animation**: `scale-in` + `fade-in` on open, reverse on close

### Functional Capabilities (via `zoe-chat` edge function)
All tool calls from the existing edge function are handled client-side:

- **Assessment CRUD**: `create_assessment`, `create_full_assessment`, `open_assessment`, `delete_assessment`, `update_assessment_title`
- **Pipeline**: `analyse_brief`, `write_all`, `write_section`, `run_critique`, `humanise_all`, `apply_revision`, `edit_proofread`, `generate_images`, `coherence_check`
- **Navigation**: `navigate_to`, `sign_out`
- **Payments**: `process_payment` (opens Paystack popup)
- **Analytics**: `read_analytics` (fetches data from DB, returns to ZOE)
- **Sources**: `find_sources` (Semantic Scholar), `web_search`
- **Content**: `read_section`, `read_assessment`, `export_document`, `export_content`
- **Settings**: `update_assessment_settings`, `adjust_word_target`, `confirm_execution_plan`
- **Charts**: `render_chart` (inline recharts)

### Tool Execution Logic
The component includes a `executeToolCall` handler that:
1. For navigation tools → calls `navigate(route)`
2. For payment → opens Paystack popup via existing `initPaystack`
3. For assessment creation → calls Supabase functions directly
4. For analytics → queries `assessments` + `profiles` tables, injects data back as context
5. For pipeline tools → calls the respective edge functions (brief-parse, section-generate, etc.)
6. For read/export → fetches sections from DB, displays or triggers download

### Message Persistence
Uses existing `chat_messages` table with `chat_id = 'dashboard'`. Loads history on mount, saves new messages.

### File Uploads
Uses existing `chat-uploads` bucket. Uploads file, gets signed URL, passes as attachment to `zoe-chat` edge function.

### Mobile Adaptations
- Panel goes full-screen on viewports < 640px
- FAB positioned above bottom nav (80px from bottom)
- Textarea gets `enterKeyHint="send"`, `autoCapitalize="sentences"`
- Close button is prominent in header

### Dynamic Greeting
Array of greetings rotated by time-of-day:
- Morning: "Good morning {name}, ready to write?"
- Afternoon: "Hey {name}, what do you have in mind?"
- Evening: "Evening {name}, let's get some work done"
- Generic: "What can I help you with today?"

## Dependencies
- `react-markdown` and `remark-gfm` (already in package.json from previous work)
- `recharts` (already installed) for inline chart rendering

## Technical Notes
- Auth token passed via `supabase.auth.getSession()` for edge function calls
- SSE streaming via existing `readContentAndToolStream` from `@/lib/sseStream`
- No new edge functions needed — reuses `zoe-chat` which already has all 30+ tools
- Dashboard `refreshData` passed to widget so tool actions that modify assessments can refresh the list

