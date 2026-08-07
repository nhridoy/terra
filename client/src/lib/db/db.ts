import { invoke } from "@tauri-apps/api/core";

// Reset the on-device SQLite cache to a pristine, fresh-install state.
// Best-effort: removes the DB file plus WAL/SHM sidecars so a re-open
// recreates all tables empty. Called on logout so no encrypted local rows
// remain on disk once the user signs out.
export async function wipeLocalData(): Promise<void> {
  await invoke("wipe_local_data");
}
