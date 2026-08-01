import { useRef } from "react";
import {
  computeLayout,
  type PlacedDivider,
  type PlacedPane,
} from "../../lib/paneLayout";
import {
  type EditorLeafNode,
  type EditorViewNode,
  findLeaf,
  useEditorStore,
} from "../../stores/editorStore";
import { SplitDivider } from "../shared/SplitDivider";
import EditorView from "./EditorView";

interface EditorViewTreeProps {
  pane: EditorLeafNode;
}

export default function EditorViewTree({ pane }: EditorViewTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tree = useEditorStore((s) => s.viewTrees[pane.id] ?? null);
  const activeViewId = useEditorStore((s) => s.activeView[pane.id] ?? null);
  const setViewSizes = useEditorStore((s) => s.setViewSizes);
  const setActiveView = useEditorStore((s) => s.setActiveView);

  const panes: PlacedPane[] = [];
  const dividers: PlacedDivider[] = [];
  if (tree) computeLayout(tree, 0, 0, 100, 100, panes, dividers);

  const findSplit = (splitId: string) => {
    const root = useEditorStore.getState().viewTrees[pane.id];
    if (!root) return null;
    const stack: EditorViewNode[] = [root];
    while (stack.length) {
      const n = stack.pop();
      if (!n) continue;
      if (n.type === "split" && n.id === splitId) return n;
      if (n.type === "split") stack.push(...n.children);
    }
    return null;
  };

  if (!tree) {
    return (
      <div className="flex-1 min-w-0 h-full">
        <EditorView pane={pane} viewId={pane.id} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 min-w-0 h-full relative">
      {panes.map((p) => {
        const leaf = findLeaf(tree, p.id);
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
            <EditorView
              pane={pane}
              viewId={leaf.id}
              isActive={leaf.id === activeViewId}
              onActivate={() => setActiveView(pane.id, leaf.id)}
            />
          </div>
        );
      })}

      {dividers.map((d) => (
        <SplitDivider
          key={d.id}
          divider={d}
          containerRef={containerRef}
          onResize={(splitId, sizes) => setViewSizes(pane.id, splitId, sizes)}
          findSplit={findSplit}
        />
      ))}
    </div>
  );
}
