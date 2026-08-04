import type { Group } from "@/stores/hosts/hostStore";

export function getChildren(groups: Group[], parentId: string): Group[] {
  return groups.filter((g) => g.parentId === parentId);
}

export function getAncestors(groups: Group[], groupId: string): Group[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const ancestors: Group[] = [];
  let current = byId.get(groupId);
  while (current?.parentId) {
    const parent = byId.get(current.parentId);
    if (parent) {
      ancestors.unshift(parent);
      current = parent;
    } else break;
  }
  return ancestors;
}
