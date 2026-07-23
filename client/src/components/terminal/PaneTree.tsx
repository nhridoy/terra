import { useRef } from "react";
import {
  computeLayout,
  countLeaves,
  type PlacedDivider,
  type PlacedPane,
} from "../../lib/paneLayout";
import {
  findLeaf,
  type PaneNode,
  useTerminalStore,
} from "../../stores/terminalStore";
import { SplitDivider } from "../shared/SplitDivider";
import Pane from "./Pane";

interface PaneTreeProps {
  tabId: string;
  node: PaneNode;
  activePaneId: string | null;
  isActiveTab: boolean;
  onRestorePreset: (
    preset: { id?: string; name?: string; layout: string },
    tabId: string,
  ) => void;
}

function findSplitInStore(tabId: string, splitId: string) {
  const tab = useTerminalStore.getState().tabs.find((t) => t.id === tabId);
  if (!tab) return null;
  const stack: PaneNode[] = [tab.root];
  while (stack.length) {
    const n = stack.pop();
    if (!n) continue;
    if (n.type === "split") {
      if (n.id === splitId) return n;
      stack.push(...n.children);
    }
  }
  return null;
}

export default function PaneTree({
  tabId,
  node,
  activePaneId,
  isActiveTab,
  onRestorePreset,
}: PaneTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setPaneSizes } = useTerminalStore();
  const closable = countLeaves(node) > 1;

  const panes: PlacedPane[] = [];
  const dividers: PlacedDivider[] = [];
  computeLayout(node, 0, 0, 100, 100, panes, dividers);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {panes.map((p) => {
        const leaf = findLeaf(node, p.id);
        if (!leaf) return null;
        return (
          <div
            key={p.id}
            className="absolute overflow-hidden"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.width}%`,
              height: `${p.height}%`,
            }}
          >
            <Pane
              tabId={tabId}
              pane={leaf}
              isActive={p.id === activePaneId}
              closable={closable}
              isActiveTab={isActiveTab}
              onRestorePreset={onRestorePreset}
            />
          </div>
        );
      })}

      {dividers.map((d) => (
        <SplitDivider
          key={d.id}
          divider={d}
          containerRef={containerRef}
          onResize={(splitId, sizes) => setPaneSizes(tabId, splitId, sizes)}
          findSplit={(splitId) => findSplitInStore(tabId, splitId)}
        />
      ))}
    </div>
  );
}
