import { invoke } from "@tauri-apps/api/core";

export interface ShellInfo {
  name: string;
  path: string;
}

let cachedShells: ShellInfo[] | null = null;

export async function detectShells(): Promise<ShellInfo[]> {
  if (cachedShells) return cachedShells;
  try {
    const shells = await invoke<ShellInfo[]>("detect_shells");
    cachedShells = shells;
    return shells;
  } catch {
    return [];
  }
}

export function getDefaultShell(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Windows")) return "powershell.exe";
  if (ua.includes("Mac")) return "/bin/zsh";
  return "/bin/bash";
}
