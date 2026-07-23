import { useCallback, useState } from "react";

export function useModal(defaultOpen = false) {
  const [open, setOpen] = useState(defaultOpen);
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  return { open, show, hide, toggle };
}
