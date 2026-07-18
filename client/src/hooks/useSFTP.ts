import { useCallback, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { FileItem } from '../lib/sftpTypes'

interface TransferItem {
  id: string
  fileName: string
  localPath?: string
  remotePath?: string
  direction: 'upload' | 'download'
  status: 'pending' | 'transferring' | 'completed' | 'failed'
  progress: number
  size: number
  transferred: number
  speed?: number
  error?: string
}

export function useSFTP(hostId: string) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [currentPath, setCurrentPath] = useState('/')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transfers] = useState<TransferItem[]>([])

  const loadDirectory = useCallback(
    async (path?: string) => {
      const dirPath = path || currentPath
      setIsLoading(true)
      setError(null)
      try {
        const result = await invoke<FileItem[]>('sftp_list', { hostId, path: dirPath })
        setFiles(result || [])
        if (path) setCurrentPath(path)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load directory')
      } finally {
        setIsLoading(false)
      }
    },
    [hostId],
  )

  const refresh = useCallback(() => {
    loadDirectory(currentPath)
  }, [loadDirectory, currentPath])

  const uploadFile = useCallback(
    async (_file: File, _targetPath?: string) => {
      setError('Upload via Tauri not yet implemented in this hook')
    },
    [],
  )

  const uploadFiles = useCallback(
    async (fileList: FileList) => {
      for (let i = 0; i < fileList.length; i++) {
        await uploadFile(fileList[i])
      }
    },
    [uploadFile],
  )

  const downloadFile = useCallback(
    async (_file: FileItem) => {
      setError('Download via Tauri not yet implemented in this hook')
    },
    [],
  )

  const deleteFile = useCallback(
    async (file: FileItem) => {
      setIsLoading(true)
      setError(null)
      try {
        await invoke('sftp_delete', { hostId, path: file.path })
        loadDirectory(currentPath)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to delete file')
      } finally {
        setIsLoading(false)
      }
    },
    [hostId, currentPath, loadDirectory],
  )

  const renameFile = useCallback(
    async (file: FileItem, newName: string) => {
      if (newName === file.name) return
      setIsLoading(true)
      setError(null)
      try {
        const newPath = currentPath + '/' + newName
        await invoke('sftp_rename', { hostId, oldPath: file.path, newPath })
        loadDirectory(currentPath)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to rename file')
      } finally {
        setIsLoading(false)
      }
    },
    [hostId, currentPath, loadDirectory],
  )

  const createFolder = useCallback(
    async (name: string) => {
      setIsLoading(true)
      setError(null)
      try {
        await invoke('sftp_mkdir', { hostId, path: currentPath + '/' + name })
        loadDirectory(currentPath)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to create folder')
      } finally {
        setIsLoading(false)
      }
    },
    [hostId, currentPath, loadDirectory],
  )

  const readFile = useCallback(
    async (_filePath: string) => {
      setError('Read file via Tauri not yet implemented in this hook')
      return null
    },
    [],
  )

  const writeFile = useCallback(
    async (_filePath: string, _content: string) => {
      setError('Write file via Tauri not yet implemented in this hook')
      return false
    },
    [],
  )

  return {
    files,
    currentPath,
    isLoading,
    error,
    transfers,
    loadDirectory,
    refresh,
    uploadFile,
    uploadFiles,
    downloadFile,
    deleteFile,
    renameFile,
    createFolder,
    readFile,
    writeFile,
    setCurrentPath,
    setError,
  }
}
