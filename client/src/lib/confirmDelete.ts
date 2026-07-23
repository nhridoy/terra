import { confirm as tauriConfirm } from "@tauri-apps/plugin-dialog";

export async function confirmDelete(
  message = "Are you sure you want to delete this?",
): Promise<boolean> {
  return await tauriConfirm(message, {
    title: "Confirm Delete",
    kind: "warning",
  });
}
