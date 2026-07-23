import type { FileItem } from "./sftpTypes";

export async function listLocalFiles(_dirPath: string): Promise<FileItem[]> {
  throw new Error("Not implemented");
}

export async function readLocalFile(_filePath: string): Promise<string> {
  throw new Error("Not implemented");
}

export async function writeLocalFile(
  _filePath: string,
  _content: string,
): Promise<void> {
  throw new Error("Not implemented");
}

export async function createLocalDir(_dirPath: string): Promise<void> {
  throw new Error("Not implemented");
}

export async function removeLocalFile(_filePath: string): Promise<void> {
  throw new Error("Not implemented");
}

export async function renameLocalFile(
  _oldPath: string,
  _newPath: string,
): Promise<void> {
  throw new Error("Not implemented");
}

export async function localFileExists(_filePath: string): Promise<boolean> {
  throw new Error("Not implemented");
}

export async function openDirectoryPicker(): Promise<string | null> {
  return null;
}

export async function openFilePicker(): Promise<string | null> {
  return null;
}

export async function saveFilePicker(
  _defaultName?: string,
): Promise<string | null> {
  return null;
}

export function isTauriAvailable(): boolean {
  return false;
}
