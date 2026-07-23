export function findLeaf<
  T extends { type: "leaf" | "split"; id: string; children?: T[] },
>(node: T, paneId: string): Extract<T, { type: "leaf" }> | null {
  if (node.type === "leaf")
    return node.id === paneId ? (node as Extract<T, { type: "leaf" }>) : null;
  for (const child of node.children ?? []) {
    const found = findLeaf(child, paneId);
    if (found) return found;
  }
  return null;
}

export function findAllLeaves<
  T extends { type: "leaf" | "split"; children?: T[] },
>(node: T): Array<Extract<T, { type: "leaf" }>> {
  if (node.type === "leaf") return [node as Extract<T, { type: "leaf" }>];
  return (node.children ?? []).flatMap(findAllLeaves);
}

export function collectStatuses<
  T extends { type: "leaf" | "split"; children?: T[] },
>(node: T, getStatus: (leaf: T) => string): string[] {
  if (node.type === "leaf") return [getStatus(node)];
  return (node.children ?? []).flatMap((child) =>
    collectStatuses(child, getStatus),
  );
}

export function findSplit<
  T extends { type: "leaf" | "split"; id: string; children?: T[] },
>(node: T, splitId: string): Extract<T, { type: "split" }> | null {
  if (node.type === "leaf") return null;
  if (node.id === splitId) return node as Extract<T, { type: "split" }>;
  for (const child of node.children ?? []) {
    const found = findSplit(child, splitId);
    if (found) return found;
  }
  return null;
}

export function replaceNode<
  T extends { type: "leaf" | "split"; id: string; children?: T[] },
>(node: T, paneId: string, replacement: T): T {
  if (node.type === "leaf") return node.id === paneId ? replacement : node;
  return {
    ...node,
    children: (node.children ?? []).map((c) =>
      replaceNode(c, paneId, replacement),
    ),
  };
}

export function removeNode<
  T extends { type: "leaf" | "split"; id: string; children?: T[] },
>(node: T, paneId: string): T | null {
  if (node.type === "leaf") return node.id === paneId ? null : node;
  const remaining = (node.children ?? [])
    .map((c) => removeNode(c, paneId))
    .filter((c): c is T => c !== null);
  if (remaining.length === 0) return null;
  if (remaining.length === 1) return remaining[0];
  return { ...node, children: remaining } as T;
}

export function recomputeSizes<
  T extends {
    type: "leaf" | "split";
    id: string;
    size: number;
    children?: T[];
  },
>(node: T): T {
  if (node.type === "leaf") return node;
  const count = (node.children ?? []).length;
  const size = Math.floor(100 / count);
  const remainder = 100 - size * count;
  return {
    ...node,
    children: (node.children ?? []).map((c, i) => ({
      ...recomputeSizes(c),
      size: i === 0 ? size + remainder : size,
    })),
  } as T;
}

export function findFirstLeafId<
  T extends { type: "leaf" | "split"; id: string; children?: T[] },
>(node: T): string | null {
  if (node.type === "leaf") return node.id;
  return findFirstLeafId((node.children ?? [])[0] ?? node);
}

export function countLeaves<
  T extends { type: "leaf" | "split"; children?: T[] },
>(node: T): number {
  if (node.type === "leaf") return 1;
  return (node.children ?? []).reduce((sum, c) => sum + countLeaves(c), 0);
}

export type DropSide = "left" | "right" | "top" | "bottom";

export function sideToDirection(side: DropSide): "horizontal" | "vertical" {
  return side === "left" || side === "right" ? "horizontal" : "vertical";
}

export function sourceFirstFromSide(side: DropSide): boolean {
  return side === "left" || side === "top";
}
