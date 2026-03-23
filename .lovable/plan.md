

# ZOE Chat on Homepage + Fix Build Errors

## Build Errors to Fix First

| File | Error | Fix |
|------|-------|-----|
| `src/pages/Dashboard.tsx:574` | `FileText` not imported | Add `FileText` to lucide-react imports |
| `src/components/writer/StageWriteHumanise.tsx:328` | `rightLabel` and `onRight` can be undefined but StickyFooter requires `string` / `() => void` | Pass empty string / no-op fallbacks when gated |
| `src/pages/Workspace.tsx:197` | `id` can be undefined | Add non-null assertion or early return guard |

## ZOE Chat on Homepage

The user wants ZOE as a floating chat icon on the **homepage** (`/` — the landing page), not the dashboard. This ZOE should have full control over the entire site — navigate, answer questions, open subscription pages, create assessments, etc.

### Architecture

**New edge function: `supabase/functions/zoe-home/index.ts`**
- Uses `getZoeBrain("chat")` with an expanded system prompt for homepage context
- Tools for: `navigate_page`, `open_subscription`, `create_assessment`, `get_info`, `list_assessments`
- Streams responses with tool calls
- No auth required (public visitors can chat; authenticated users get more tools)

**New hook: `src/hooks/useZoeHome.ts`**
- Manages chat messages, streaming via `readContentAndToolStream`
- Executes tool calls client-side: `navigate_page` → `window.location.href`, `open_subscription` → scroll to pricing or open Paystack, `create_assessment` → redirect to `/assessment/new`
- Handles auth state — if logged in, sends user context; if not, ZOE can still answer questions

**New component: `src/components/chat/ZoeHomeChat.tsx`**
- Full-screen chat overlay triggered by FAB
- Clean UI inspired by ChatGPT/WhatsApp:
  - Dark header with "ZOE" branding and close button
  - Scrollable message area with markdown rendering (react-markdown already installed from earlier)
  - User messages right-aligned (terracotta), ZOE messages left-aligned (card bg)
  - Input bar with text input + send button at bottom
  - Welcome message with suggestion chips ("What can ZOE do?", "Show me pricing", "Create an assessment")
- Tool result rendering inline (navigation confirmations, subscription cards)

**Modified: `src/pages/Index.tsx`**
- Import and render `ZoeHomeChat` component
- Floating chat FAB (reuse `DraggableChatFab` pattern but visible on all screen sizes)

### ZOE's Homepage Capabilities

| Tool | What it does |
|------|-------------|
| `navigate_page` | Navigate to any app route (/dashboard, /auth, /analytics, /assessment/new, /pricing section) |
| `open_subscription` | Scroll to pricing section or show tier info inline |
| `get_app_info` | Answer questions about ZOE, features, pricing, how it works |
| `create_assessment` | Redirect to /auth if not logged in, or /assessment/new if logged in |
| `show_pricing` | Display tier comparison inline in chat |

### Files

| File | Action |
|------|--------|
| `src/pages/Dashboard.tsx` | Fix: add `FileText` import |
| `src/components/writer/StageWriteHumanise.tsx` | Fix: handle undefined rightLabel/onRight |
| `src/pages/Workspace.tsx` | Fix: guard against undefined `id` |
| `supabase/functions/zoe-home/index.ts` | Create: homepage chat edge function with navigation + info tools |
| `src/hooks/useZoeHome.ts` | Create: chat hook for homepage ZOE |
| `src/components/chat/ZoeHomeChat.tsx` | Create: ChatGPT-style chat overlay component |
| `src/pages/Index.tsx` | Modify: add ZOE FAB + chat overlay |

