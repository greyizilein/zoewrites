

## Make Chat Button Draggable on Mobile

The floating ZOE chat button (line 1055–1062 in `WriterEngine.tsx`) is fixed at `bottom-20 right-4` and can block footer action buttons on mobile.

### Approach

Extract the floating button into a new component `DraggableChatFab.tsx` that uses touch events (`onTouchStart`, `onTouchMove`, `onTouchEnd`) to let users drag the button to any screen edge position. It will:

- Track position via `useState` with default `{ bottom: 80, right: 16 }`
- On drag, update position using `touch.clientY` / `touch.clientX` deltas
- Snap to nearest horizontal edge (left or right) on release for a clean look
- Persist position in `localStorage` so it remembers across sessions
- Keep the same visual style (terracotta circle, MessageCircle icon)
- Only enable drag on mobile (the button is already `md:hidden`)

### Files to Change

| File | Change |
|------|--------|
| `src/components/writer/DraggableChatFab.tsx` | New component with touch-drag logic |
| `src/pages/WriterEngine.tsx` | Replace inline button (lines 1055–1062) with `<DraggableChatFab>` |

### Technical Detail

The component uses `position: fixed` with `top`/`left` style (computed from touch coordinates), clamped to viewport bounds. A small threshold distinguishes taps from drags — if moved < 5px, it triggers `onClick` to open chat instead of repositioning.

