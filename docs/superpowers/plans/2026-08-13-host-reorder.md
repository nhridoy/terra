# Host Card Reorder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable drag-and-drop reordering of host cards within the same group with live swap preview.

**Architecture:** Convert host cards from `useDraggable`/`useDroppable` to `useSortable` from `@dnd-kit/react/sortable`. Preview state managed in a Zustand store. On drop, persist new `sort_order` to SQLite.

**Tech Stack:** React, Zustand, `@dnd-kit/react` v0.5, `@dnd-kit/react/sortable`, `@dnd-kit/helpers`, TypeScript.

## Global Constraints

- pnpm only — never npm
- Biome enforces single quotes, space indent
- `@dnd-kit/react` v0.5 API — `useSortable` from `@dnd-kit/react/sortable`, `move` from `@dnd-kit/helpers`
- `DragDropProvider` in `Layout.tsx` wraps all DnD — no nested providers
- `sort_order` column exists in SQLite with `DEFAULT 0` — no migration needed
- Existing DnD types: `host-source`, `host-target`, `group-source`, `group-target`, `root-target`
- New sortable type: `host` (replaces `host-source` and `host-target` for sortable cards)

---

### Task 1: Create `dragPreviewStore`

**Files:**
- Create: `src/stores/dragPreviewStore.ts`

**Interfaces:**
- Consumes: `Host` type from `@/stores/hosts/hostStore`
- Produces: `useDragPreviewStore` — `{ previewHosts, isDragging, setPreview, clearPreview }`

- [ ] **Step 1: Create the store file**

```typescript
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

- [ ] **Step 2: Verify it compiles**

Run: `cd client && pnpm biome check src/stores/dragPreviewStore.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/stores/dragPreviewStore.ts
git commit -m "feat: add drag preview store for host reorder"
```

---

### Task 2: Convert `DraggableHostCard` to `useSortable`

**Files:**
- Modify: `src/components/hosts/cards/DraggableHostCard.tsx`

**Interfaces:**
- Consumes: `Host` type, `useDragPreviewStore` (for `isDragging` state)
- Produces: Card component with `index` prop, uses `useSortable` instead of `useDraggable`/`useDroppable`

- [ ] **Step 1: Replace imports**

Remove:
```typescript
import { useDraggable, useDroppable } from "@dnd-kit/react";
```

Add:
```typescript
import { closestCenter } from "@dnd-kit/collision";
import { useSortable } from "@dnd-kit/react/sortable";
```

- [ ] **Step 2: Update component props**

Remove `isDropTarget` and `onReorder` props. Add `index` prop:

```typescript
export function DraggableHostCard({
  host,
  index,
  onConnect,
  onEdit,
  onDelete,
}: {
  host: Host;
  index: number;
  onConnect: (host: Host) => void;
  onEdit: (host: Host) => void;
  onDelete: (id: string) => void;
}) {
```

- [ ] **Step 3: Replace DnD hooks with useSortable**

Remove:
```typescript
const { ref: draggableRef, isDragging } = useDraggable({
  id: `host:${host.id}`,
  data: { type: "host-source", hostId: host.id },
});
const { ref: droppableRef, isOver } = useDroppable({
  id: `host-drop:${host.id}`,
  data: { type: "host-target", hostId: host.id },
});

const setRefs = (el: HTMLDivElement | null) => {
  draggableRef(el);
  droppableRef(el);
};
```

Add:
```typescript
const { ref, isDragging, isOver } = useSortable({
  id: `host:${host.id}`,
  index,
  data: { type: "host", hostId: host.id },
  collisionDetector: closestCenter,
});
```

- [ ] **Step 4: Update the div ref**

Replace `ref={setRefs}` with `ref={ref}` on the outer `<div>`.

- [ ] **Step 5: Verify it compiles**

Run: `cd client && pnpm biome check src/components/hosts/cards/DraggableHostCard.tsx`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/hosts/cards/DraggableHostCard.tsx
git commit -m "feat: convert host card to useSortable for drag reorder"
```

---

### Task 3: Update `HostsPanel` to use preview store

**Files:**
- Modify: `src/components/hosts/panels/HostsPanel.tsx`

**Interfaces:**
- Consumes: `useDragPreviewStore` from `@/stores/dragPreviewStore`
- Produces: Panel that renders preview order during drag, passes `index` to cards

- [ ] **Step 1: Add import**

```typescript
import { useDragPreviewStore } from "@/stores/dragPreviewStore";
```

- [ ] **Step 2: Read preview state and compute displayHosts**

Replace the current `displayHosts` computation:

```typescript
const { hosts, groups } = useHostStore();
```

With:

```typescript
const { hosts, groups } = useHostStore();
const { previewHosts, isDragging } = useDragPreviewStore();
```

Replace the `displayHosts` computation:

```typescript
const displayHosts = selectedGroupId
  ? hosts.filter((h) => h.groupId === selectedGroupId)
  : hosts;
```

With:

```typescript
const displayHosts = isDragging && previewHosts
  ? (selectedGroupId
      ? previewHosts.filter((h) => h.groupId === selectedGroupId)
      : previewHosts)
  : (selectedGroupId
      ? hosts.filter((h) => h.groupId === selectedGroupId)
      : hosts);
```

- [ ] **Step 3: Pass index to DraggableHostCard**

Replace:

```tsx
{displayHosts.map((host) => (
  <DraggableHostCard
    key={host.id}
    host={host}
    onConnect={onConnect}
    onEdit={onEditHost}
    onDelete={onDeleteHost}
  />
))}
```

With:

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

- [ ] **Step 4: Verify it compiles**

Run: `cd client && pnpm biome check src/components/hosts/panels/HostsPanel.tsx`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/hosts/panels/HostsPanel.tsx
git commit -m "feat: HostsPanel reads drag preview store for reorder"
```

---

### Task 4: Update `useLayoutDragDrop` for preview lifecycle

**Files:**
- Modify: `src/hooks/layout/useLayoutDragDrop.ts`

**Interfaces:**
- Consumes: `useDragPreviewStore`, `move` from `@dnd-kit/helpers`, `isSortable` from `@dnd-kit/react/sortable`
- Produces: Drag handlers that manage preview state during host reorder

- [ ] **Step 1: Add imports**

Add to existing imports:

```typescript
import { useDragPreviewStore } from "@/stores/dragPreviewStore";
```

The `move` and `isSortable` imports already exist.

- [ ] **Step 2: Update handleDragStart to snapshot hosts**

Replace:

```typescript
const handleDragStart = (event: DragStartEvent) => {
  const { source } = event.operation;
  if (source?.data?.type === "pane-source") {
    setSourcePane({
      paneId: String(source.data.paneId),
      tabId: String(source.data.tabId),
    });
  }
  setDropPane(null);
};
```

With:

```typescript
const handleDragStart = (event: DragStartEvent) => {
  const { source } = event.operation;
  if (source?.data?.type === "pane-source") {
    setSourcePane({
      paneId: String(source.data.paneId),
      tabId: String(source.data.tabId),
    });
  }
  if (source?.data?.type === "host") {
    useDragPreviewStore.getState().setPreview(hosts);
  }
  setDropPane(null);
};
```

- [ ] **Step 3: Update handleDragOver for host→host swap preview**

Replace the existing host-source/host-target early returns:

```typescript
if (sourceType === "host-source" && target?.data?.type === "group-target")
  return;
if (sourceType === "host-source" && target?.data?.type === "root-target")
  return;
if (sourceType === "host-source" && target?.data?.type === "host-target")
  return;
```

With:

```typescript
if (sourceType === "host" && target?.data?.type === "group-target")
  return;
if (sourceType === "host" && target?.data?.type === "root-target")
  return;
if (
  sourceType === "host" &&
  target?.data?.type === "host" &&
  source.data.hostId !== target.data.hostId
) {
  const sourceHost = hosts.find((h) => h.id === source.data.hostId);
  const targetHost = hosts.find((h) => h.id === target.data.hostId);
  if (
    sourceHost &&
    targetHost &&
    sourceHost.groupId === targetHost.groupId
  ) {
    const preview =
      useDragPreviewStore.getState().previewHosts ?? hosts;
    const reordered = move(preview, event);
    useDragPreviewStore.getState().setPreview(reordered);
  }
  return;
}
```

- [ ] **Step 4: Update handleDragEnd for host→host swap persistence**

Replace the host-source/host-target swap block:

```typescript
if (
  source.data?.type === "host-source" &&
  target?.data?.type === "host-target" &&
  source.data.hostId !== target.data.hostId
) {
  void reorderHost(
    String(source.data.hostId),
    String(target.data.hostId),
  );
  setDropPane(null);
  setSourcePane(null);
  return;
}
```

With:

```typescript
if (
  source.data?.type === "host" &&
  target?.data?.type === "host" &&
  source.data.hostId !== target.data.hostId
) {
  const { initialIndex, index } = source;
  if (initialIndex !== index) {
    const preview =
      useDragPreviewStore.getState().previewHosts ?? hosts;
    const reordered = move(preview, event);
    for (const [i, h] of reordered.entries()) {
      if (h.sortOrder !== i) {
        void updateHost(h.id, { sortOrder: i });
      }
    }
  }
  useDragPreviewStore.getState().clearPreview();
  setDropPane(null);
  setSourcePane(null);
  return;
}
```

- [ ] **Step 5: Update host-source/group-target and host-source/root-target blocks**

Replace:

```typescript
if (
  source.data?.type === "host-source" &&
  target?.data?.type === "group-target"
) {
  updateHost(String(source.data.hostId), {
    groupId: String(target.data.groupId),
  });
  setDropPane(null);
  setSourcePane(null);
  return;
}

if (
  source.data?.type === "host-source" &&
  target?.data?.type === "root-target"
) {
  updateHost(String(source.data.hostId), { groupId: "" });
  setDropPane(null);
  setSourcePane(null);
  return;
}
```

With:

```typescript
if (
  source.data?.type === "host" &&
  target?.data?.type === "group-target"
) {
  useDragPreviewStore.getState().clearPreview();
  updateHost(String(source.data.hostId), {
    groupId: String(target.data.groupId),
  });
  setDropPane(null);
  setSourcePane(null);
  return;
}

if (
  source.data?.type === "host" &&
  target?.data?.type === "root-target"
) {
  useDragPreviewStore.getState().clearPreview();
  updateHost(String(source.data.hostId), { groupId: "" });
  setDropPane(null);
  setSourcePane(null);
  return;
}
```

- [ ] **Step 6: Add clearPreview to the final fallback and cancel paths**

Replace the final else block:

```typescript
} else {
  setDropPane(null);
  setSourcePane(null);
}
```

With:

```typescript
} else {
  useDragPreviewStore.getState().clearPreview();
  setDropPane(null);
  setSourcePane(null);
}
```

Also add `useDragPreviewStore.getState().clearPreview();` to the cancel path at line 89-93:

```typescript
if (event.canceled || !source) {
  useDragPreviewStore.getState().clearPreview();
  setDropPane(null);
  setSourcePane(null);
  return;
}
```

- [ ] **Step 7: Verify it compiles**

Run: `cd client && pnpm biome check src/hooks/layout/useLayoutDragDrop.ts`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/hooks/layout/useLayoutDragDrop.ts
git commit -m "feat: add preview lifecycle to drag handlers for host reorder"
```

---

### Task 5: Rewrite `reorderHost` to swap

**Files:**
- Modify: `src/stores/hosts/hostStore.ts`

**Interfaces:**
- Consumes: `updateHost` from the same store
- Produces: `reorderHost` that swaps sort_order between two hosts

- [ ] **Step 1: Replace reorderHost implementation**

Replace:

```typescript
reorderHost: async (sourceId, targetId) => {
  const all = get().hosts;
  const source = all.find((h) => h.id === sourceId);
  const target = all.find((h) => h.id === targetId);
  if (!source || !target) return;

  // Move source to target's group if different
  if (source.groupId !== target.groupId) {
    await updateHost(sourceId, { groupId: target.groupId ?? null });
  }

  // Re-fetch after potential group change
  const updated = get().hosts;
  const groupId = target.groupId ?? null;
  const ordered = updated
    .filter((h) => (h.groupId ?? null) === groupId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Remove source, find target index, insert before target
  const srcIdx = ordered.findIndex((h) => h.id === sourceId);
  const [moved] = ordered.splice(srcIdx, 1);
  const tgtIdx = ordered.findIndex((h) => h.id === targetId);
  ordered.splice(tgtIdx, 0, moved);

  // Reassign sequential sort_order
  for (const [i, h] of ordered.entries()) {
    if (h.sortOrder !== i) {
      await updateHost(h.id, { sortOrder: i });
    }
  }
},
```

With:

```typescript
reorderHost: async (sourceId, targetId) => {
  const all = get().hosts;
  const source = all.find((h) => h.id === sourceId);
  const target = all.find((h) => h.id === targetId);
  if (!source || !target) return;

  const tmpOrder = source.sortOrder;
  await updateHost(sourceId, { sortOrder: target.sortOrder });
  await updateHost(targetId, { sortOrder: tmpOrder });
},
```

- [ ] **Step 2: Verify it compiles**

Run: `cd client && pnpm biome check src/stores/hosts/hostStore.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/stores/hosts/hostStore.ts
git commit -m "feat: rewrite reorderHost to swap sort_order"
```

---

### Task 6: Update DragOverlay in `Layout.tsx`

**Files:**
- Modify: `src/components/layout/shell/Layout.tsx`

**Interfaces:**
- Consumes: Updated host data type (`host` instead of `host-source`)
- Produces: DragOverlay that renders correct preview for sortable host cards

- [ ] **Step 1: Update the host overlay type check**

Replace:

```typescript
if (source.data?.type === "host-source") {
  const host = hosts.find((h) => h.id === source.data.hostId);
```

With:

```typescript
if (source.data?.type === "host") {
  const host = hosts.find((h) => h.id === source.data.hostId);
```

- [ ] **Step 2: Verify it compiles**

Run: `cd client && pnpm biome check src/components/layout/shell/Layout.tsx`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/shell/Layout.tsx
git commit -m "feat: update DragOverlay for sortable host type"
```

---

### Task 7: Run all tests and verify

**Files:**
- No file changes

- [ ] **Step 1: Run biome check on all modified files**

Run: `cd client && pnpm biome check src/stores/dragPreviewStore.ts src/components/hosts/cards/DraggableHostCard.tsx src/components/hosts/panels/HostsPanel.tsx src/hooks/layout/useLayoutDragDrop.ts src/stores/hosts/hostStore.ts src/components/layout/shell/Layout.tsx`
Expected: No errors

- [ ] **Step 2: Run existing tests**

Run: `cd client && pnpm vitest run`
Expected: 13 test files passed, 140 tests passed

- [ ] **Step 3: Run TypeScript type check**

Run: `cd client && pnpm tsc --noEmit 2>&1 | head -20`
Expected: No new type errors (pre-existing authStore.test.ts errors are known)

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address review feedback for host reorder"
```

---

### Task 8: Update `createHost` to assign correct sort_order

**Files:**
- Modify: `src/stores/hosts/hostStore.ts`

**Interfaces:**
- Consumes: `get().hosts` to compute max sort_order
- Produces: `createHost` that assigns `sort_order: max(same-group) + 1`

- [ ] **Step 1: Update createHost sort_order computation**

In the `createHost` function, replace:

```typescript
sort_order: host.sortOrder ?? 0,
```

With:

```typescript
sort_order:
  host.sortOrder ??
  (() => {
    const groupHosts = get().hosts.filter(
      (h) => (h.groupId ?? null) === (host.groupId ?? null),
    );
    return groupHosts.length > 0
      ? Math.max(...groupHosts.map((h) => h.sortOrder)) + 1
      : 0;
  })(),
```

- [ ] **Step 2: Verify it compiles**

Run: `cd client && pnpm biome check src/stores/hosts/hostStore.ts`
Expected: No errors

- [ ] **Step 3: Run tests**

Run: `cd client && pnpm vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/stores/hosts/hostStore.ts
git commit -m "feat: assign sequential sort_order on host creation"
```
