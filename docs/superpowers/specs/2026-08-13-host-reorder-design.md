# Host Card Reorder — Design Spec

## Goal

Allow users to reorder host cards via drag-and-drop within the same group. Dragging host A over host B shows a live swap preview (grid reflows like tabs). On drop, the new `sort_order` is persisted to SQLite.

## Scope

- **In scope:** Host card reordering within the same group, live preview during drag, sort_order persistence.
- **Out of scope:** Group reordering, cross-group host reordering, server-side sort_order sync.

## Approach

Match the existing tab reordering pattern: convert host cards from `useDraggable`/`useDroppable` to `useSortable` from `@dnd-kit/react/sortable`. Preview state managed in a dedicated Zustand store, consumed by the host list renderer.

## Architecture

### Component Changes

#### `DraggableHostCard.tsx`

Replace `useDraggable` + `useDroppable` with a single `useSortable`:

```tsx
import { useSortable } from "@dnd-kit/react/sortable";
import { closestCenter } from "@dnd-kit/collision";

const { ref, isDragging, isOver } = useSortable({
  id: `host:${host.id}`,
  index,
  data: { type: "host", hostId: host.id },
  collisionDetector: closestCenter,
});
```

- Accept new `index: number` prop (position in the current display list).
- Remove `onReorder` prop (unused — reorder handled by DnD handler).
- `isDragging` → `opacity-50` on the card.
- `isOver` → `border-primary-500 ring-2 ring-primary-500` on the card.
- The `ref` from `useSortable` replaces both `draggableRef` and `droppableRef`. Remove the `setRefs` merge logic.

#### `HostsPanel.tsx`

Read preview state from `useDragPreviewStore`:

```tsx
const { previewHosts, isDragging } = useDragPreviewStore();
const displayHosts = isDragging && previewHosts
  ? previewHosts
  : selectedGroupId
    ? hosts.filter((h) => h.groupId === selectedGroupId)
    : hosts;
```

Pass `index` to each card:

```tsx
{displayHosts.map((host, index) => (
  <DraggableHostCard
    key={host.id}
    host={host}
    index={index}
    onConnect={onConnect}
    onEdit={onEditHost}
    onDelete={onDeleteHost}
  />
))}
```

#### `useLayoutDragDrop.ts`

Add preview lifecycle to drag handlers:

**`handleDragStart`:**
```tsx
const { hosts } = useHostStore.getState();
useDragPreviewStore.getState().setPreview(hosts);
```

**`handleDragOver`** — add host→host swap detection:
```tsx
if (source.data?.type === "host" && target?.data?.type === "host"
    && source.data.hostId !== target.data.hostId) {
  const sourceHost = hosts.find(h => h.id === source.data.hostId);
  const targetHost = hosts.find(h => h.id === target.data.hostId);
  if (sourceHost && targetHost && sourceHost.groupId === targetHost.groupId) {
    const preview = useDragPreviewStore.getState().previewHosts ?? hosts;
    const reordered = move(preview, event);
    useDragPreviewStore.getState().setPreview(reordered);
  }
}
```

**`handleDragEnd`** — persist swap and clear preview:
```tsx
if (source.data?.type === "host" && target?.data?.type === "host"
    && source.data.hostId !== target.data.hostId) {
  const { initialIndex, index } = source;
  if (initialIndex !== index) {
    const preview = useDragPreviewStore.getState().previewHosts ?? hosts;
    const reordered = move(preview, event);
    // Persist new sort_order for all hosts in the group
    for (const [i, h] of reordered.entries()) {
      if (h.sortOrder !== i) {
        await updateHost(h.id, { sortOrder: i });
      }
    }
  }
}
useDragPreviewStore.getState().clearPreview();
```

**Existing group/root drop handlers:** unchanged — they handle `group-target` and `root-target` types which don't conflict with sortable host cards.

#### `hostStore.ts` — `reorderHost`

Rewrite to swap `sort_order` between two hosts (replaces insert-before logic):

```tsx
reorderHost: async (sourceId, targetId) => {
  const all = get().hosts;
  const source = all.find(h => h.id === sourceId);
  const target = all.find(h => h.id === targetId);
  if (!source || !target) return;

  // Swap sort_order values
  const tmpOrder = source.sortOrder;
  await updateHost(sourceId, { sortOrder: target.sortOrder });
  await updateHost(targetId, { sortOrder: tmpOrder });
},
```

Note: The `handleDragEnd` in `useLayoutDragDrop.ts` now handles persistence directly via `move()` + `updateHost()` loop, so this `reorderHost` function may become unused. Keep it as a fallback API.

#### `dragPreviewStore.ts` (new file)

```tsx
import { create } from "zustand";
import type { Host } from "@/stores/hosts/hostStore";

interface DragPreviewState {
  previewHosts: Host[] | null;
  isDragging: boolean;
  setPreview: (hosts: Host[]) => void;
  clearPreview: () => void;
}

export const useDragPreviewStore = create<DragPreviewState>((set) => ({
  previewHosts: null,
  isDragging: false,
  setPreview: (hosts) => set({ previewHosts: hosts, isDragging: true }),
  clearPreview: () => set({ previewHosts: null, isDragging: false }),
}));
```

#### `Layout.tsx` — DragOverlay

Update the host overlay check from `host-source` to `host`:

```tsx
if (source.data?.type === "host") {
  const host = hosts.find((h) => h.id === source.data.hostId);
  // ...existing preview card JSX...
}
```

### Data Flow

```
dragStart
  └→ snapshot hosts → dragPreviewStore

dragOver (host→host, same group)
  └→ move(previewHosts, event) → dragPreviewStore
  └→ HostsPanel reads previewHosts → re-renders grid in new order
  └→ useSortable indices update → CSS transforms animate reflow

dragEnd
  └→ move(previewHosts, event) → final order
  └→ for each host: if sortOrder changed → updateHost(id, { sortOrder })
  └→ clearPreview()

dragEnd (canceled)
  └→ clearPreview() → reverts to store order
```

### Sort Order Assignment

- **New hosts:** `createHost` assigns `sort_order: max(same-group hosts' sortOrder) + 1` (or 0 if group is empty).
- **Reorder:** On drop, all hosts in the affected group get sequential `sort_order` values (0, 1, 2, ...) based on the preview order.
- **DB:** `sort_order` column exists with `DEFAULT 0` in both client SQLite and server GORM models. No migration needed.

### Edge Cases

| Case | Behavior |
|------|----------|
| Drag host to different group's host card | No swap — same-group check prevents it. Host stays in original position. |
| Drag host to group card | Existing move-to-group logic (unchanged). No swap preview. |
| Drag canceled (released outside valid target) | Preview clears, reverts to original order. |
| Only one host in group | No swap possible — `isOver` triggers but swap is a no-op. |
| Concurrent drags | Not supported — single `DragDropProvider` with pointer sensor. |

### Testing

- Existing `hostStore.test.ts` tests pass (15 tests).
- Add test for `reorderHost` swap behavior.
- Add test for `dragPreviewStore` set/clear.
- Manual test: drag host over another, verify live reflow, verify sort_order persisted after drop.

## Files to Modify

| File | Action |
|------|--------|
| `src/components/hosts/cards/DraggableHostCard.tsx` | Modify — useSortable, add index prop |
| `src/components/hosts/panels/HostsPanel.tsx` | Modify — read preview store, pass index |
| `src/hooks/layout/useLayoutDragDrop.ts` | Modify — preview lifecycle in drag handlers |
| `src/stores/hosts/hostStore.ts` | Modify — rewrite reorderHost to swap |
| `src/components/layout/shell/Layout.tsx` | Modify — update DragOverlay type check |
| `src/stores/dragPreviewStore.ts` | Create — preview state store |
