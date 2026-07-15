import type { FileItem } from './sftpTypes'

const TAURI_ERROR = 'Local filesystem is only available in the desktop app. Run "npm run tauri dev" to test locally.'

function ensureTauri(): void {
  if (typeof window === 'undefined' || !(window as any).__TAURI__) {
    throw new Error(TAURI_ERROR)
  }
}

async function loadTauriFs() {
  ensureTauri()
  return import('@tauri-apps/api/fs')
}

async function loadTauriDialog() {
  ensureTauri()
  return import('@tauri-apps/api/dialog')
}

export async function listLocalFiles(dirPath: string): Promise<FileItem[]> {
  const { readDir } = await loadTauriFs()
  const entries = await readDir(dirPath)
  const items: FileItem[] = []

  for (const entry of entries) {
    const name = entry.name || entry.path.split(/[/\\]/).pop() || ''
    let type: FileItem['type'] = 'file'
    try {
      await readDir(entry.path)
      type = 'directory'
    } catch {
      type = 'file'
    }

    items.push({
      name,
      path: entry.path,
      type,
      size: 0,
      permissions: '',
      owner: '',
      group: '',
      modifiedAt: new Date().toISOString(),
      isHidden: name.startsWith('.'),
    })
  }

  return items
}

export async function readLocalFile(filePath: string): Promise<string> {
  const { readTextFile } = await loadTauriFs()
  return readTextFile(filePath)
}

export async function writeLocalFile(filePath: string, content: string): Promise<void> {
  const { writeTextFile } = await loadTauriFs()
  await writeTextFile(filePath, content)
}

export async function createLocalDir(dirPath: string): Promise<void> {
  const { createDir } = await loadTauriFs()
  await createDir(dirPath, { recursive: true })
}

export async function removeLocalFile(filePath: string): Promise<void> {
  const { removeFile } = await loadTauriFs()
  await removeFile(filePath)
}

export async function renameLocalFile(oldPath: string, newPath: string): Promise<void> {
  const { renameFile } = await loadTauriFs()
  await renameFile(oldPath, newPath)
}

export async function localFileExists(filePath: string): Promise<boolean> {
  const { exists } = await loadTauriFs()
  return exists(filePath)
}

export async function openDirectoryPicker(): Promise<string | null> {
  const { open } = await loadTauriDialog()
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Select Directory',
  })
  if (selected && typeof selected === 'string') return selected
  return null
}

export async function openFilePicker(): Promise<string | null> {
  const { open } = await loadTauriDialog()
  const selected = await open({
    multiple: false,
    title: 'Select File',
  })
  if (selected && typeof selected === 'string') return selected
  return null
}

export async function saveFilePicker(defaultName?: string): Promise<string | null> {
  const { save } = await loadTauriDialog()
  const selected = await save({
    defaultPath: defaultName,
    title: 'Save File',
  })
  return selected || null
}

export function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI__
}
