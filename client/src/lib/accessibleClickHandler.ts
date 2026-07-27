import type { KeyboardEvent } from "react";

export function accessibleClickHandler(action: () => void) {
  return (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };
}
