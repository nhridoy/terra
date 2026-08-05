import { useRef } from "react";
import { SplitDivider } from "@/components/common/SplitDivider";
import Pane from "@/components/terminal/panes/Pane";
import {
  computeLayout,
  countLeaves,
  type PlacedDivider,
  type PlacedPane,
} from "@/lib/common/paneLayout";
import {
  findLeaf,
  type PaneNode,
  useTerminalStore,
} from "@/stores/terminal/terminalStore";

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
  const setPaneSizes = useTerminalStore((s) => s.setPaneSizes);
  const setFocusedPane = useTerminalStore((s) => s.setFocusedPane);
  const focusedPaneId = useTerminalStore(
    (s) => s.tabs.find((t) => t.id === tabId)?.focusedPaneId ?? null,
  );
  const closable = countLeaves(node) > 1;
  const draggable = countLeaves(node) > 1;
  const canFocus = countLeaves(node) > 1;
  const hasFocus = canFocus && focusedPaneId !== null;

  const panes: PlacedPane[] = [];
  const dividers: PlacedDivider[] = [];
  computeLayout(node, 0, 0, 100, 100, panes, dividers);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {panes.map((p) => {
        const leaf = findLeaf(node, p.id);
        if (!leaf) return null;
        const isFocusedPane = hasFocus && p.id === focusedPaneId;
        return (
          <div
            key={p.id}
            className={`absolute overflow-hidden ${
              hasFocus && !isFocusedPane ? "hidden" : ""
            }`}
            style={
              isFocusedPane
                ? { left: 0, top: 0, width: "100%", height: "100%" }
                : {
                    left: `${p.left}%`,
                    top: `${p.top}%`,
                    width: `${p.width}%`,
                    height: `${p.height}%`,
                  }
            }
          >
            <Pane
              tabId={tabId}
              pane={leaf}
              isActive={p.id === activePaneId}
              closable={closable}
              draggable={draggable}
              isActiveTab={isActiveTab}
              canFocus={canFocus}
              isFocused={isFocusedPane}
              onToggleFocus={() =>
                setFocusedPane(tabId, isFocusedPane ? null : leaf.id)
              }
              onRestorePreset={onRestorePreset}
            />
          </div>
        );
      })}

      {hasFocus
        ? null
        : dividers.map((d) => (
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
