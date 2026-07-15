import { useCallback, useState } from 'react'
import api from '../lib/api'
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
        const result = await api.listFiles(hostId, dirPath)
        setFiles(result.files)
        if (path) setCurrentPath(path)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load directory')
      } finally {
        setIsLoading(false)
      }
    },
    [hostId, currentPath],
  )

  const navigateUp = useCallback(() => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/'
    loadDirectory(parent)
  }, [currentPath, loadDirectory])

  const navigateTo = useCallback(
    (path: string) => {
      loadDirectory(path)
    },
    [loadDirectory],
  )

  const refresh = useCallback(() => {
    loadDirectory(currentPath)
  }, [loadDirectory, currentPath])

  const uploadFile = useCallback(
    async (file: File, targetPath?: string) => {
      const path = targetPath || currentPath
      setIsLoading(true)
      setError(null)
      try {
        await api.uploadFileWithProgress(hostId, path, file)
        loadDirectory(currentPath)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to upload file')
      } finally {
        setIsLoading(false)
      }
    },
    [hostId, currentPath, loadDirectory],
  )

  const uploadFiles = useCallback(
    async (fileList: FileList) => {
      setIsLoading(true)
      setError(null)
      try {
        for (let i = 0; i < fileList.length; i++) {
          await uploadFile(fileList[i])
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to upload files')
      } finally {
        setIsLoading(false)
      }
    },
    [uploadFile],
  )

  const downloadFile = useCallback(
    async (file: FileItem) => {
      setIsLoading(true)
      setError(null)
      try {
        await api.downloadFileBlob(hostId, file.path, file.name)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to download file')
      } finally {
        setIsLoading(false)
      }
    },
    [hostId],
  )

  const deleteFile = useCallback(
    async (file: FileItem) => {
      setIsLoading(true)
      setError(null)
      try {
        await api.deleteFile(hostId, file.path)
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
        await api.moveFile(hostId, file.path, newPath)
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
        await api.createDirectory(hostId, currentPath, name)
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
    async (filePath: string) => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await api.readFile(hostId, filePath)
        return result.content
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to read file')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [hostId],
  )

  const writeFile = useCallback(
    async (filePath: string, content: string) => {
      setIsLoading(true)
      setError(null)
      try {
        await api.writeFile(hostId, filePath, content)
        return true
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to write file')
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [hostId],
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    files,
    currentPath,
    isLoading,
    error,
    transfers,
    loadDirectory,
    navigateUp,
    navigateTo,
    refresh,
    uploadFile,
    uploadFiles,
    downloadFile,
    deleteFile,
    renameFile,
    createFolder,
    readFile,
    writeFile,
    clearError,
  }
}
