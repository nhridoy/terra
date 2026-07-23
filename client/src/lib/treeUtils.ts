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
