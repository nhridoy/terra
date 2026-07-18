import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDraggable, useDroppable, useDragDropMonitor } from '@dnd-kit/react'
import { pointerIntersection } from '@dnd-kit/collision'
import { CollisionPriority } from '@dnd-kit/abstract'
import { invoke } from '@tauri-apps/api/core'
import type { FileItem, FileSortDirection, FileSortField, FileViewMode } from '../../lib/sftpTypes'
import { useSftpStore, findAllLeaves } from '../../stores/sftpStore'
import ContextMenu, { type ContextMenuItem } from '../ui/ContextMenu'
import Modal from '../ui/Modal'
import { toast } from '../ui/Toast'

interface FileBrowserProps {
  paneId?: string
  hostId: string
  hostAddress?: string
  hostPort?: number
  hostUsername?: string
  onFileSelect?: (file: FileItem) => void
}

export default function FileBrowser({ paneId = 'standalone', hostId, hostAddress, hostPort, hostUsername, onFileSelect }: FileBrowserProps) {
  const fileDragState = useSftpStore((s) => s.fileDragState)
  const setFileDragState = useSftpStore((s) => s.setFileDragState)
  const pendingFileDrop = useSftpStore((s) => s.pendingFileDrop)
  const setPendingFileDrop = useSftpStore((s) => s.setPendingFileDrop)
  const [files, setFiles] = useState<FileItem[]>([])
  const [currentPath, setCurrentPath] = useState('/')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<FileViewMode>('list')
  const [showHidden, setShowHidden] = useState(false)
  const [sortField, setSortField] = useState<FileSortField>('name')
  const [sortDirection, setSortDirection] = useState<FileSortDirection>('asc')
  const [searchQuery, setSearchQuery] = useState('')
  const [pathInput, setPathInput] = useState(currentPath)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileItem | null } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isDropTarget, setIsDropTarget] = useState(false)
  const [pasteConflicts, setPasteConflicts] = useState<{ srcPath: string; dstPath: string; dstName: string }[] | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ files: FileItem[]; selectedNames: Set<string> | null } | null>(null)
  const [pendingDrop, setPendingDrop] = useState<{ files: FileItem[]; sourceHostId: string; destHostId: string; destDirPath: string; sourceDirect?: { host?: string; port?: number; username?: string }; sourcePaneId?: string } | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const addTransfer = useSftpStore((s) => s.addTransfer)
  const updateTransfer = useSftpStore((s) => s.updateTransfer)
  const clipboard = useSftpStore((s) => s.clipboard)
  const clipboardMode = useSftpStore((s) => s.clipboardMode)
  const setClipboard = useSftpStore((s) => s.setClipboard)
  const clearClipboard = useSftpStore((s) => s.clearClipboard)
  const activePaneId = useSftpStore((s) => s.activePaneId)
  const requestRefresh = useSftpStore((s) => s.requestRefresh)
  const refreshVersion = useSftpStore((s) => s.refreshRequests[paneId] ?? 0)

  useEffect(() => {
    loadDirectory(currentPath)
    setPathInput(currentPath)
  }, [hostId, currentPath])

  // Reload when another pane requests a refresh on this pane
  useEffect(() => {
    if (refreshVersion > 0) {
      loadDirectory(currentPath)
    }
  }, [refreshVersion])

  useEffect(() => {
    if (renamingPath && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingPath])

  const loadDirectory = async (path: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await invoke<FileItem[]>('sftp_list', { hostId, path })
      setFiles(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load directory')
    } finally {
      setIsLoading(false)
    }
  }

  const navigateTo = (path: string) => {
    setCurrentPath(path)
    setSelectedFiles(new Set())
    setSearchQuery('')
  }

  const navigateUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/'
    navigateTo(parent)
  }

  const handleDoubleClick = (file: FileItem) => {
    if (file.type === 'directory') {
      navigateTo(file.path)
    } else if (onFileSelect) {
      onFileSelect(file)
    }
  }

  const handleSelect = (fileName: string, isMultiSelect: boolean, isShift = false, allFiles: FileItem[] = []) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(isMultiSelect ? prev : [])
      if (isShift && !isMultiSelect && prev.size > 0 && allFiles.length > 0) {
        const lastSelected = [...prev].pop()
        const lastIdx = allFiles.findIndex((f) => f.name === lastSelected)
        const currentIdx = allFiles.findIndex((f) => f.name === fileName)
        if (lastIdx !== -1 && currentIdx !== -1) {
          const start = Math.min(lastIdx, currentIdx)
          const end = Math.max(lastIdx, currentIdx)
          for (let i = start; i <= end; i++) {
            newSet.add(allFiles[i].name)
          }
        }
      } else if (newSet.has(fileName)) {
        newSet.delete(fileName)
      } else {
        newSet.add(fileName)
      }
      return newSet
    })
  }

  const handleUpload = async (fileList: FileList) => {
    const filesArray = Array.from(fileList)
    let completed = 0

    for (const file of filesArray) {
      const transferId = `upload_${Date.now()}_${file.name}`
      addTransfer({
        id: transferId,
        fileName: file.name,
        remotePath: currentPath + '/' + file.name,
        direction: 'upload',
        status: 'active',
        progress: 0,
        size: file.size,
        transferred: 0,
      })
      try {
        throw new Error('Upload not available in sync-only mode')
        updateTransfer(transferId, { status: 'complete', progress: 100 })
        completed++
      } catch (err: unknown) {
        updateTransfer(transferId, { status: 'error', error: err instanceof Error ? err.message : 'Upload failed' })
        toast(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
      }
    }

    if (completed > 0) {
      toast(`Uploaded ${completed} file${completed > 1 ? 's' : ''}`, 'success')
      loadDirectory(currentPath)
    }
  }

  const handleDownload = async (file: FileItem) => {
    const transferId = `download_${Date.now()}_${file.name}`
    addTransfer({
      id: transferId,
      fileName: file.name,
      remotePath: file.path,
      direction: 'download',
      status: 'active',
      progress: 0,
      size: file.size,
      transferred: 0,
    })
    try {
      throw new Error('Download not available in sync-only mode')
      updateTransfer(transferId, { status: 'complete', progress: 100, transferred: file.size })
      toast(`Downloaded ${file.name}`, 'success')
    } catch (err: unknown) {
      updateTransfer(transferId, { status: 'error', error: err instanceof Error ? err.message : 'Download failed' })
      toast(`Failed to download ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    }
  }

  const handleDelete = async (file: FileItem) => {
    setDeleteConfirm({ files: [file], selectedNames: null })
  }

  const handleDeleteSelected = async () => {
    const toDelete = [...selectedFiles]
    if (toDelete.length === 0) return
    const fileItems = toDelete.map((name) => files.find((f) => f.name === name)).filter(Boolean) as FileItem[]
    setDeleteConfirm({ files: fileItems, selectedNames: new Set(toDelete) })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    const { files: toDelete, selectedNames } = deleteConfirm
    setDeleteConfirm(null)

    // Optimistic: remove immediately
    const pathsToRemove = new Set(toDelete.map((f) => f.path))
    setFiles((prev) => prev.filter((f) => !pathsToRemove.has(f.path)))
    if (selectedNames) setSelectedFiles(new Set())

    let failed = 0
    for (const file of toDelete) {
      try {
        await invoke('sftp_delete', { hostId, path: file.path })
      } catch {
        failed++
      }
    }

    if (failed > 0) {
      toast(`Failed to delete ${failed} item${failed > 1 ? 's' : ''}`, 'error')
      loadDirectory(currentPath)
    } else {
      toast(`Deleted ${toDelete.length} item${toDelete.length > 1 ? 's' : ''}`, 'success')
    }
  }

  const startRename = (file: FileItem) => {
    setRenamingPath(file.path)
    setRenameValue(file.name)
  }

  const commitRename = async () => {
    if (!renamingPath) return
    const file = files.find((f) => f.path === renamingPath)
    if (!file || renameValue === file.name || !renameValue.trim()) {
      setRenamingPath(null)
      return
    }
    const newName = renameValue.trim()
    const newPath = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`

    // Check for name conflict before attempting
    if (files.some((f) => f.path !== renamingPath && f.name === newName)) {
      toast(`A file named "${newName}" already exists`, 'error')
      setRenamingPath(null)
      return
    }

    // Optimistic: update immediately
    const oldFile = { ...file }
    setFiles((prev) => prev.map((f) => f.path === renamingPath ? { ...f, name: newName, path: newPath, isHidden: newName.startsWith('.') } : f))
    setRenamingPath(null)

    try {
      await invoke('sftp_rename', { hostId, oldPath: file.path, newPath })
      toast(`Renamed to ${newName}`, 'success')
    } catch (err: unknown) {
      // Revert optimistic update
      setFiles((prev) => prev.map((f) => f.path === newPath ? oldFile : f))
      toast(`Failed to rename: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    }
  }

  const handleNewFolder = async () => {
    const name = window.prompt('Enter folder name:')
    if (!name) return
    const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`

    // Optimistic: add immediately
    setFiles((prev) => [...prev, {
      name,
      path: newPath,
      type: 'directory',
      size: 0,
      permissions: 'drwxr-xr-x',
      owner: '',
      group: '',
      modifiedAt: new Date().toISOString(),
      isHidden: name.startsWith('.'),
    }])

    try {
      await invoke('sftp_mkdir', { hostId, path: newPath })
      toast(`Created folder ${name}`, 'success')
    } catch (err: unknown) {
      // Revert optimistic update
      setFiles((prev) => prev.filter((f) => f.path !== newPath))
      toast(`Failed to create folder: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    }
  }

  const handleNewFile = async () => {
    const name = window.prompt('Enter file name:')
    if (!name) return
    const filePath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`

    // Optimistic: add immediately
    setFiles((prev) => [...prev, {
      name,
      path: filePath,
      type: 'file',
      size: 0,
      permissions: '-rw-r--r--',
      owner: '',
      group: '',
      modifiedAt: new Date().toISOString(),
      isHidden: name.startsWith('.'),
    }])

    try {
      await invoke('sftp_write', { hostId, path: filePath, data: '' })
      toast(`Created file ${name}`, 'success')
    } catch (err: unknown) {
      // Revert optimistic update
      setFiles((prev) => prev.filter((f) => f.path !== filePath))
      toast(`Failed to create file: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    }
  }

  // ---- File drag & drop ----

  const executeFileDrop = async (dragFiles: FileItem[], sourceHostId: string, destHostId: string, destDirPath: string, overrides?: Map<string, { action: 'replace' | 'rename' | 'auto' | 'skip'; newName?: string }>, sourceDirect?: { host?: string; port?: number; username?: string }, sourcePaneId?: string) => {
    const isMove = sourceHostId === destHostId
    let successCount = 0
    let failCount = 0

    // Check for name conflicts by listing the destination directory
    try {
      const destResult = await invoke<FileItem[]>('sftp_list', { hostId: destHostId, path: destDirPath })
      const destNames = new Set(destResult.map((f: FileItem) => f.name))
      const conflicts = dragFiles.filter((f) => destNames.has(f.name))

      if (conflicts.length > 0) {
        setPasteConflicts(conflicts.map((f) => ({
          srcPath: f.path,
          dstPath: destDirPath === '/' ? `/${f.name}` : `${destDirPath}/${f.name}`,
          dstName: f.name,
        })))
        setPendingDrop({ files: dragFiles, sourceHostId, destHostId, destDirPath, sourceDirect, sourcePaneId })
        setFileDragState(null)
        return
      }
    } catch (e) {
      console.error('executeFileDrop: failed to list destination directory', e)
    }

    // Optimistic updates
    if (destDirPath === currentPath) {
      // Dropping into the current directory — add the entries (e.g. paste from clipboard)
      const newFileEntries: FileItem[] = dragFiles.map((f) => ({
        ...f,
        path: destDirPath === '/' ? `/${f.name}` : `${destDirPath}/${f.name}`,
      }))
      setFiles((prev) => [...prev, ...newFileEntries])
    }

    // If move within same host, remove from source optimistically
    if (isMove) {
      const movedPaths = new Set(dragFiles.map((f) => f.path))
      setFiles((prev) => prev.filter((f) => !movedPaths.has(f.path)))
    }

    // Pre-generate auto names
    const autoNames = new Map<string, string>()
    if (overrides) {
      const existingNames = dragFiles.map((f) => f.name)
      for (const [srcPath, res] of overrides) {
        if (res.action === 'auto') {
          const srcName = srcPath.split('/').pop() || ''
          autoNames.set(srcPath, generateAutoName(srcName, existingNames))
          existingNames.push(autoNames.get(srcPath)!)
        }
      }
    }

    for (const file of dragFiles) {
      const override = overrides?.get(file.path)
      if (override?.action === 'skip') continue

      let dstName: string
      if (override?.action === 'rename' && override.newName) {
        dstName = override.newName
      } else if (override?.action === 'auto') {
        dstName = autoNames.get(file.path) || file.name
      } else {
        dstName = file.name
      }
      const dstPath = destDirPath === '/' ? `/${dstName}` : `${destDirPath}/${dstName}`

      try {
        if (isMove) {
          await invoke('sftp_rename', { hostId: sourceHostId, oldPath: file.path, newPath: dstPath })
        } else if (sourceHostId !== destHostId) {
          throw new Error('Cross-host copy not available in sync-only mode')
        } else {
          await invoke('sftp_copy', { hostId: sourceHostId, srcPath: file.path, dstPath })
        }
        successCount++
      } catch (e) {
        console.error(`executeFileDrop: failed to ${isMove ? 'move' : 'copy'} ${file.path}`, e)
        failCount++
      }
    }

    if (successCount > 0) {
      toast(`${isMove ? 'Moved' : 'Copied'} ${successCount} item${successCount > 1 ? 's' : ''}`, 'success')
      // After same-host move, refresh the source pane
      if (isMove && sourcePaneId && sourcePaneId !== paneId) {
        requestRefresh(sourcePaneId)
      }
    }
    if (failCount > 0) {
      toast(`Failed to ${isMove ? 'move' : 'copy'} ${failCount} item${failCount > 1 ? 's' : ''}`, 'error')
      loadDirectory(currentPath)
    }

  }

  const handleCopy = () => {
    const paths = [...selectedFiles].map((name) => {
      const file = files.find((f) => f.name === name)
      return file?.path || `${currentPath}/${name}`
    })
    if (paths.length === 0) return
    const srcDirect = hostId.startsWith('direct_') ? { host: hostAddress, port: hostPort, username: hostUsername } : undefined
    setClipboard(hostId, paths, 'copy', srcDirect)
    toast(`Copied ${paths.length} item${paths.length > 1 ? 's' : ''}`, 'info')
  }

  const handleCut = () => {
    const paths = [...selectedFiles].map((name) => {
      const file = files.find((f) => f.name === name)
      return file?.path || `${currentPath}/${name}`
    })
    if (paths.length === 0) return
    const srcDirect = hostId.startsWith('direct_') ? { host: hostAddress, port: hostPort, username: hostUsername } : undefined
    setClipboard(hostId, paths, 'cut', srcDirect)
    toast(`Cut ${paths.length} item${paths.length > 1 ? 's' : ''}`, 'info')
  }

  const handlePaste = async () => {
    if (!clipboard || !clipboardMode) return

    // Detect conflicts: check if any destination file already exists
    const existingNames = new Set(files.map((f) => f.name))
    const conflicts: { srcPath: string; dstPath: string; dstName: string }[] = []

    for (const srcPath of clipboard.paths) {
      const srcName = srcPath.split('/').pop() || ''
      if (existingNames.has(srcName)) {
        const dstPath = currentPath === '/' ? `/${srcName}` : `${currentPath}/${srcName}`
        conflicts.push({ srcPath, dstPath, dstName: srcName })
      }
    }

    if (conflicts.length > 0) {
      setPasteConflicts(conflicts)
      return
    }

    // No conflicts — proceed directly
    await executePaste()
  }

  const executePaste = async (overrides?: Map<string, { action: 'replace' | 'rename' | 'auto' | 'skip'; newName?: string }>) => {
    if (!clipboard || !clipboardMode) return
    let successCount = 0
    let failCount = 0

    // Pre-generate auto names for all auto-resolved conflicts
    const autoNames = new Map<string, string>()
    if (overrides) {
      const existingNames = files.map((f) => f.name)
      for (const [srcPath, res] of overrides) {
        if (res.action === 'auto') {
          const srcName = srcPath.split('/').pop() || ''
          autoNames.set(srcPath, generateAutoName(srcName, existingNames))
          existingNames.push(autoNames.get(srcPath)!)
        }
      }
    }

    // Collect pending optimistic updates
    const newFiles: FileItem[] = []
    const removePaths: string[] = []
    const replaceEntries: { path: string; file: FileItem }[] = []

    for (const srcPath of clipboard.paths) {
      const srcName = srcPath.split('/').pop() || ''
      const override = overrides?.get(srcPath)

      if (override?.action === 'skip') continue

      let dstName: string
      if (override?.action === 'rename' && override.newName) {
        dstName = override.newName
      } else if (override?.action === 'auto') {
        dstName = autoNames.get(srcPath) || srcName
      } else {
        dstName = srcName
      }
      const dstPath = currentPath === '/' ? `/${dstName}` : `${currentPath}/${dstName}`

      // Find the source file info for optimistic update
      const srcFile = files.find((f) => f.path === srcPath)
      const isReplace = override?.action === 'replace' || (!override && files.some((f) => f.path === dstPath))

      try {
        const isCrossHost = clipboard.hostId !== hostId
        if (clipboardMode === 'copy') {
          if (isCrossHost) {
            throw new Error('Cross-host copy not available in sync-only mode')
          } else {
            await invoke('sftp_copy', { hostId: clipboard.hostId, srcPath, dstPath })
          }
        } else {
          if (isCrossHost) {
            throw new Error('Cross-host move not available in sync-only mode')
          } else {
            await invoke('sftp_rename', { hostId: clipboard.hostId, oldPath: srcPath, newPath: dstPath })
          }
        }
        successCount++

        if (isReplace) {
          // Replace: update existing entry
          const existing = files.find((f) => f.path === dstPath)
          if (existing) {
            replaceEntries.push({ path: dstPath, file: { ...existing, name: dstName, path: dstPath } })
          }
        } else {
          // New file: add optimistic entry
          newFiles.push({
            name: dstName,
            path: dstPath,
            type: srcFile?.type || 'file',
            size: srcFile?.size || 0,
            permissions: srcFile?.permissions || '',
            owner: srcFile?.owner || '',
            group: srcFile?.group || '',
            modifiedAt: new Date().toISOString(),
            isHidden: dstName.startsWith('.'),
          })
        }

        // For cut: remove from source if same directory
        if (clipboardMode === 'cut') {
          const srcDir = srcPath.split('/').slice(0, -1).join('/') || '/'
          if (srcDir === currentPath && srcFile) {
            removePaths.push(srcPath)
          }
        }
      } catch {
        failCount++
      }
    }

    // Apply optimistic updates
    if (newFiles.length > 0 || removePaths.length > 0 || replaceEntries.length > 0) {
      setFiles((prev) => {
        let next = prev.filter((f) => !removePaths.includes(f.path))
        for (const { path, file } of replaceEntries) {
          next = next.map((f) => f.path === path ? file : f)
        }
        return [...next, ...newFiles]
      })
    }

    if (clipboardMode === 'cut') clearClipboard()

    if (successCount > 0) {
      toast(`${clipboardMode === 'copy' ? 'Copied' : 'Moved'} ${successCount} item${successCount > 1 ? 's' : ''}`, 'success')
      // After same-host cut, refresh other panes showing the same host so they see the file is gone
      if (clipboardMode === 'cut' && clipboard.hostId === hostId) {
        const { root } = useSftpStore.getState()
        const otherPanes = findAllLeaves(root).filter((l) => l.id !== paneId && l.hostId === hostId)
        for (const p of otherPanes) {
          requestRefresh(p.id)
        }
      }
    }
    if (failCount > 0) {
      toast(`Failed to ${clipboardMode === 'copy' ? 'copy' : 'move'} ${failCount} item${failCount > 1 ? 's' : ''}`, 'error')
      loadDirectory(currentPath)
    }
  }

  // Drag & drop from desktop only (in-app handled by dnd-kit)
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files)
    }
  }, [handleUpload])

  // In-app file drop via dnd-kit
  const droppable = useDroppable({
    id: `file-drop-${paneId}`,
    data: {
      type: 'file-drop',
      paneId,
      hostId,
      path: currentPath,
    },
    collisionDetector: pointerIntersection,
  })

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    droppable.ref(node)
  }, [droppable.ref])

  // Track whether this pane is a valid drop target for the full overlay
  useDragDropMonitor({
    onDragOver(event) {
      const source = event.operation.source
      const target = event.operation.target
      if (source?.data?.type === 'file-drag' && target?.data?.type === 'file-drop') {
        const sourceHostId = source.data.hostId as string
        const destHostId = target.data.hostId as string
        const files = source.data.files as FileItem[]
        const destDirPath = target.data.path as string
        const srcDir = files[0]?.path.split('/').slice(0, -1).join('/') || '/'
        const isNoop = sourceHostId === destHostId && srcDir === destDirPath
        const isTargetingEmptySpace = destDirPath === currentPath
        setIsDropTarget(!isNoop && isTargetingEmptySpace)
      } else {
        setIsDropTarget(false)
      }
    },
    onDragEnd() {
      setIsDropTarget(false)
    },
  })

  // Pick up pending file drops from dnd-kit (set by SftpLayout.onDragEnd)
  useEffect(() => {
    if (!pendingFileDrop) return
    if (pendingFileDrop.destPaneId !== paneId) return
    executeFileDrop(pendingFileDrop.files, pendingFileDrop.sourceHostId, pendingFileDrop.destHostId, pendingFileDrop.destDirPath, undefined, pendingFileDrop.sourceDirect, pendingFileDrop.sourcePaneId)
    setPendingFileDrop(null)
  }, [pendingFileDrop, paneId, executeFileDrop])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only handle keyboard shortcuts in the active pane
      if (activePaneId && activePaneId !== paneId) return

      // Dialog-level shortcuts
      if (deleteConfirm) {
        if (e.key === 'Enter') { e.preventDefault(); confirmDelete(); return }
        if (e.key === 'Escape') { e.preventDefault(); setDeleteConfirm(null); return }
        return
      }
      if (pasteConflicts) {
        if (e.key === 'Enter') {
          e.preventDefault()
          const container = document.querySelector('[data-paste-dialog]') as HTMLElement | null
          const btn = container?.querySelector('button:last-child') as HTMLButtonElement | null
          btn?.click()
          return
        }
        if (e.key === 'Escape') { e.preventDefault(); setPasteConflicts(null); return }
        return
      }

      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (e.key === 'Delete') {
        e.preventDefault()
        handleDeleteSelected()
      } else if (e.key === 'F2') {
        e.preventDefault()
        if (selectedFiles.size === 1) {
          const name = [...selectedFiles][0]
          const file = files.find((f) => f.name === name)
          if (file) startRename(file)
        }
      } else if (e.key === 'F5') {
        e.preventDefault()
        loadDirectory(currentPath)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        navigateUp()
      } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSelectedFiles(new Set(sortedFiles.map((f) => f.name)))
      } else if (e.key === 'Escape') {
        setSelectedFiles(new Set())
      } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleCopy()
      } else if (e.key === 'x' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleCut()
      } else if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handlePaste()
      } else if (e.key === 'N' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault()
        handleNewFile()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedFiles, files, currentPath, clipboard, clipboardMode, deleteConfirm, pasteConflicts, confirmDelete, activePaneId, paneId])

  const sortedFiles = useMemo(() => {
    return [...files]
      .filter((f) => (showHidden || !f.isHidden) && (searchQuery === '' || f.name.toLowerCase().includes(searchQuery.toLowerCase())))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        let cmp = 0
        if (sortField === 'name') cmp = a.name.localeCompare(b.name)
        else if (sortField === 'size') cmp = a.size - b.size
        else if (sortField === 'permissions') cmp = a.permissions.localeCompare(b.permissions)
        else if (sortField === 'modifiedAt') cmp = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()
        return sortDirection === 'asc' ? cmp : -cmp
      })
  }, [files, showHidden, searchQuery, sortField, sortDirection])

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  const getFileIcon = (file: FileItem) => {
    if (file.type === 'directory') {
      return (
        <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      )
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const color = extColors[ext] || 'text-dark-400'
    return (
      <svg className={`w-5 h-5 ${color} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }

  const handleContextMenu = (e: React.MouseEvent, file: FileItem | null = null) => {
    e.preventDefault()
    e.stopPropagation()
    if (file) {
      if (!selectedFiles.has(file.name)) {
        setSelectedFiles(new Set([file.name]))
      }
    }
    setContextMenu({ x: e.clientX, y: e.clientY, file })
  }

  const contextMenuItems: ContextMenuItem[] = contextMenu ? [
    // File-specific items
    ...(contextMenu.file ? [
      ...(contextMenu.file.type === 'directory' ? [{
        label: 'Open',
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
        shortcut: 'Enter',
        onClick: () => handleDoubleClick(contextMenu.file!),
      }] : []),
      ...(contextMenu.file.type === 'file' ? [{
        label: 'Download',
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
        shortcut: 'Enter',
        onClick: () => handleDownload(contextMenu.file!),
      }] : []),
      { type: 'separator' as const },
      {
        label: 'Copy',
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
        shortcut: 'Ctrl+C',
        onClick: () => handleCopy(),
      },
      {
        label: 'Cut',
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" /></svg>,
        shortcut: 'Ctrl+X',
        onClick: () => handleCut(),
      },
    ] : []),
    // Paste (available in both modes)
    ...(clipboard && clipboard.paths.length > 0 ? [{
      label: 'Paste',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
      shortcut: 'Ctrl+V',
      onClick: () => handlePaste(),
    }] : []),
    { type: 'separator' as const },
    {
      label: 'New Folder',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      shortcut: 'Ctrl+Shift+N',
      onClick: () => handleNewFolder(),
    },
    {
      label: 'New File',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      shortcut: 'Ctrl+Shift+N',
      onClick: () => handleNewFile(),
    },
    { type: 'separator' as const },
    // File-only items
    ...(contextMenu.file ? [
      {
        label: 'Rename',
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
        shortcut: 'F2',
        onClick: () => startRename(contextMenu.file!),
      },
      {
        label: 'Copy path',
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
        onClick: () => { navigator.clipboard.writeText(contextMenu.file!.path); toast('Path copied', 'info') },
      },
      { type: 'separator' as const },
      {
        label: 'Delete',
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
        shortcut: 'Del',
        danger: true,
        onClick: () => handleDelete(contextMenu.file!),
      },
    ] : []),
  ] : []

  const handlePathKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const normalized = pathInput.startsWith('/') ? pathInput : '/' + pathInput
      navigateTo(normalized)
    } else if (e.key === 'Escape') {
      setPathInput(currentPath)
    }
  }



  return (
    <div
      ref={setContainerRef}
      className="h-full flex flex-col bg-dark-900 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Upload overlay (desktop files) */}
      {isDragOver && !fileDragState && (
        <div className="absolute inset-0 z-50 bg-primary-600/20 border-2 border-dashed border-primary-500 rounded-lg flex items-center justify-center" onDragOver={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}>
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto text-primary-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-primary-300 text-lg font-medium">Drop files to upload</p>
          </div>
        </div>
      )}

      {/* In-app file drag overlay — only if not a no-op (same host + same dir) */}
      {isDropTarget && fileDragState && (() => {
        const isCrossHost = fileDragState.sourceHostId !== hostId
        return (
          <div className={`absolute inset-0 z-50 ${isCrossHost ? 'bg-green-600/15 border-green-500' : 'bg-primary-600/15 border-primary-500'} border-2 border-dashed rounded-lg flex items-center justify-center`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}>
            <div className="text-center">
              <svg className={`w-12 h-12 mx-auto mb-2 ${isCrossHost ? 'text-green-400' : 'text-primary-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isCrossHost ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                )}
              </svg>
              <p className={`text-lg font-medium ${isCrossHost ? 'text-green-300' : 'text-primary-300'}`}>
                {isCrossHost ? 'Drop to copy between servers' : 'Drop to move'}
              </p>
            </div>
          </div>
        )
      })()}

      {/* Toolbar */}
      <div className="p-3 border-b border-dark-700">
        <div className="flex items-center gap-2 mb-2">
          {/* Home button */}
          <button onClick={() => navigateTo('/')} className="p-1.5 hover:bg-dark-700 rounded" title="Home">
            <svg className="w-4 h-4 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>

          {/* Up button */}
          <button onClick={navigateUp} className="p-1.5 hover:bg-dark-700 rounded" title="Up (Backspace)">
            <svg className="w-4 h-4 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>

          {/* Refresh */}
          <button onClick={() => loadDirectory(currentPath)} className="p-1.5 hover:bg-dark-700 rounded" title="Refresh (F5)">
            <svg className="w-4 h-4 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Breadcrumb / path input */}
          <input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={handlePathKeyDown}
            onBlur={() => setPathInput(currentPath)}
            className="flex-1 bg-dark-800 border border-dark-600 rounded px-2 py-1 text-sm text-white font-mono focus:border-primary-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Upload button */}
          <label className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded text-sm cursor-pointer transition-colors">
            Upload
            <input type="file" className="hidden" multiple onChange={(e) => e.target.files && handleUpload(e.target.files)} />
          </label>

          <button onClick={handleNewFolder} className="bg-dark-700 hover:bg-dark-600 text-white px-3 py-1 rounded text-sm transition-colors">
            New Folder
          </button>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <svg className="w-4 h-4 text-dark-400 absolute left-2 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter..."
              className="w-full bg-dark-800 border border-dark-600 rounded pl-8 pr-2 py-1 text-sm text-white placeholder-dark-400 focus:border-primary-500 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-1.5 text-dark-400 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
              className="rounded bg-dark-700 border-dark-600 text-primary-500 focus:ring-primary-500"
            />
            Hidden
          </label>

          {/* View mode toggle */}
          <div className="flex bg-dark-700 rounded overflow-hidden">
            <button onClick={() => setViewMode('list')} className={`p-1 ${viewMode === 'list' ? 'bg-primary-600' : 'hover:bg-dark-600'}`}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button onClick={() => setViewMode('grid')} className={`p-1 ${viewMode === 'grid' ? 'bg-primary-600' : 'hover:bg-dark-600'}`}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-red-200">&times;</button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex-1 p-3 space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
              <div className="w-5 h-5 bg-dark-700 rounded" />
              <div className="h-3 bg-dark-700 rounded flex-1" style={{ width: `${40 + Math.random() * 40}%` }} />
              <div className="h-3 bg-dark-700 rounded w-16" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sortedFiles.length === 0 && (
        <div
          className="flex-1 flex flex-col items-center justify-center text-dark-400"
          onContextMenu={(e) => handleContextMenu(e)}
        >
          <svg className="w-16 h-16 mb-3 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p>{searchQuery ? 'No matching files' : 'Empty directory'}</p>
        </div>
      )}

      {/* File list */}
      {!isLoading && sortedFiles.length > 0 && (
        <div
          className="flex-1 overflow-y-auto"
          onContextMenu={(e) => handleContextMenu(e)}
        >
          {viewMode === 'list' ? (
            <table className="w-full">
              <thead className="bg-dark-800 sticky top-0">
                <tr className="text-left text-dark-400 text-xs">
                  <th className="p-2 w-8" />
                  <th className="p-2">
                    <button onClick={() => { setSortField('name'); setSortDirection((d) => d === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-1 hover:text-white">
                      Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="p-2 w-20">
                    <button onClick={() => { setSortField('size'); setSortDirection((d) => d === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-1 hover:text-white">
                      Size {sortField === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="p-2 w-24">
                    <button onClick={() => { setSortField('permissions'); setSortDirection((d) => d === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-1 hover:text-white">
                      Perms {sortField === 'permissions' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="p-2 w-36">
                    <button onClick={() => { setSortField('modifiedAt'); setSortDirection((d) => d === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-1 hover:text-white">
                      Modified {sortField === 'modifiedAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedFiles.map((file) => (
                  <FileTableRow
                    key={file.path}
                    file={file}
                    paneId={paneId}
                    hostId={hostId}
                    hostAddress={hostAddress}
                    hostPort={hostPort}
                    hostUsername={hostUsername}
                    selectedFiles={selectedFiles}
                    files={files}
                    renamingPath={renamingPath}
                    renameValue={renameValue}
                    renameInputRef={renameInputRef}
                    commitRename={commitRename}
                    setRenamingPath={setRenamingPath}
                    setRenameValue={setRenameValue}
                    onDoubleClick={() => handleDoubleClick(file)}
                    onSelect={handleSelect}
                    sortedFiles={sortedFiles}
                    onContextMenu={handleContextMenu}
                    getFileIcon={getFileIcon}
                    formatSize={formatSize}
                    formatDate={formatDate}
                  />
                ))}
              </tbody>
            </table>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 p-3">
              {sortedFiles.map((file) => (
                <FileGridItem
                  key={file.path}
                  file={file}
                  paneId={paneId}
                  hostId={hostId}
                  hostAddress={hostAddress}
                  hostPort={hostPort}
                  hostUsername={hostUsername}
                  selectedFiles={selectedFiles}
                  files={files}
                  renamingPath={renamingPath}
                  renameValue={renameValue}
                  renameInputRef={renameInputRef}
                  commitRename={commitRename}
                  setRenamingPath={setRenamingPath}
                  setRenameValue={setRenameValue}
                  onDoubleClick={() => handleDoubleClick(file)}
                  onSelect={handleSelect}
                  sortedFiles={sortedFiles}
                  onContextMenu={handleContextMenu}
                  getFileIcon={getFileIcon}
                  formatSize={formatSize}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status bar */}
      <div className="px-3 py-1.5 border-t border-dark-700 text-dark-400 text-xs flex justify-between">
        <span>{sortedFiles.length} item{sortedFiles.length !== 1 ? 's' : ''}</span>
        {selectedFiles.size > 0 && <span>{selectedFiles.size} selected</span>}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu items={contextMenuItems} x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} />
      )}

      {/* Paste conflict dialog */}
      {pasteConflicts && (
        <PasteConflictDialog
          conflicts={pasteConflicts}
          onConfirm={(overrides) => {
            setPasteConflicts(null)
            if (pendingDrop) {
              executeFileDrop(pendingDrop.files, pendingDrop.sourceHostId, pendingDrop.destHostId, pendingDrop.destDirPath, overrides, pendingDrop.sourceDirect, pendingDrop.sourcePaneId)
              setPendingDrop(null)
            } else {
              executePaste(overrides)
            }
          }}
          onCancel={() => {
            setPasteConflicts(null)
            setPendingDrop(null)
            if (clipboardMode === 'cut') clearClipboard()
          }}
        />
      )}

      {deleteConfirm && (
        <Modal open onClose={() => setDeleteConfirm(null)} title="Confirm Delete" maxWidth="max-w-sm">
          <div className="space-y-4">
            <p className="text-sm text-dark-300">
              {deleteConfirm.files.length === 1
                ? <>Are you sure you want to delete <span className="text-white font-medium">{deleteConfirm.files[0].name}</span>?</>
                : <>Are you sure you want to delete <span className="text-white font-medium">{deleteConfirm.files.length} items</span>?</>
              }
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 text-sm rounded bg-dark-700 hover:bg-dark-600 text-dark-300">Cancel</button>
              <button onClick={confirmDelete} className="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 text-white">Delete</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

interface PasteConflictDialogProps {
  conflicts: { srcPath: string; dstPath: string; dstName: string }[]
  onConfirm: (overrides: Map<string, { action: 'replace' | 'rename' | 'auto' | 'skip'; newName?: string }>) => void
  onCancel: () => void
}

function PasteConflictDialog({ conflicts, onConfirm, onCancel }: PasteConflictDialogProps) {
  const [resolutions, setResolutions] = useState<Map<string, { action: 'replace' | 'rename' | 'auto' | 'skip'; newName?: string }>>(() => {
    const map = new Map<string, { action: 'replace' | 'rename' | 'auto' | 'skip'; newName?: string }>()
    for (const c of conflicts) {
      map.set(c.srcPath, { action: 'replace' })
    }
    return map
  })

  const setAction = (srcPath: string, action: 'replace' | 'rename' | 'auto' | 'skip') => {
    setResolutions((prev) => {
      const next = new Map(prev)
      const existing = next.get(srcPath) || { action: 'replace' as const }
      next.set(srcPath, { ...existing, action })
      return next
    })
  }

  const setNewName = (srcPath: string, newName: string) => {
    setResolutions((prev) => {
      const next = new Map(prev)
      const existing = next.get(srcPath) || { action: 'replace' as const }
      next.set(srcPath, { ...existing, newName })
      return next
    })
  }

  const applyToAll = (action: 'replace' | 'rename' | 'auto' | 'skip') => {
    setResolutions((prev) => {
      const next = new Map(prev)
      for (const [key, val] of prev) {
        next.set(key, { ...val, action })
      }
      return next
    })
  }

  return (
    <Modal open onClose={onCancel} title="Paste Conflicts" maxWidth="max-w-md">
      <div data-paste-dialog className="space-y-3">
        <p className="text-sm text-dark-300">
          {conflicts.length} file{conflicts.length > 1 ? 's' : ''} already exist{conflicts.length === 1 ? 's' : ''} in this directory.
        </p>

        {/* Apply to all */}
        <div className="flex gap-2 pb-2 border-b border-dark-700">
          <button onClick={() => applyToAll('replace')} className="px-2 py-1 text-xs rounded bg-dark-700 hover:bg-dark-600 text-dark-300">Replace all</button>
          <button onClick={() => applyToAll('auto')} className="px-2 py-1 text-xs rounded bg-dark-700 hover:bg-dark-600 text-dark-300">Auto rename all</button>
          <button onClick={() => applyToAll('skip')} className="px-2 py-1 text-xs rounded bg-dark-700 hover:bg-dark-600 text-dark-300">Skip all</button>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-2">
          {conflicts.map((conflict) => {
            const res = resolutions.get(conflict.srcPath) || { action: 'replace' as const }
            return (
              <div key={conflict.srcPath} className="bg-dark-800 rounded-lg p-3 space-y-2">
                <div className="text-sm text-white font-mono truncate">{conflict.dstName}</div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setAction(conflict.srcPath, 'replace')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${res.action === 'replace' ? 'bg-primary-600 text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}
                  >
                    Replace
                  </button>
                  <button
                    onClick={() => setAction(conflict.srcPath, 'rename')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${res.action === 'rename' ? 'bg-primary-600 text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => setAction(conflict.srcPath, 'auto')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${res.action === 'auto' ? 'bg-primary-600 text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}
                  >
                    Auto rename
                  </button>
                  <button
                    onClick={() => setAction(conflict.srcPath, 'skip')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${res.action === 'skip' ? 'bg-primary-600 text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}
                  >
                    Skip
                  </button>
                </div>
                {res.action === 'rename' && (
                  <input
                    autoFocus
                    value={res.newName || conflict.dstName}
                    onChange={(e) => setNewName(conflict.srcPath, e.target.value)}
                    className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1 text-sm text-white font-mono focus:border-primary-500 focus:outline-none"
                  />
                )}
                {res.action === 'auto' && (
                  <div className="text-xs text-dark-400 font-mono">
                    {generateAutoName(conflict.dstName, conflicts.map((c) => c.dstName))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-dark-700">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded bg-dark-700 hover:bg-dark-600 text-dark-300">Cancel</button>
          <button
            onClick={() => onConfirm(resolutions)}
            className="px-3 py-1.5 text-sm rounded bg-primary-600 hover:bg-primary-700 text-white"
          >
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  )
}

function generateAutoName(originalName: string, existingNames: string[]): string {
  const dotIndex = originalName.lastIndexOf('.')
  let base: string
  let ext: string
  if (dotIndex > 0) {
    base = originalName.slice(0, dotIndex)
    ext = originalName.slice(dotIndex)
  } else {
    base = originalName
    ext = ''
  }

  let candidate = `${base} (copy)${ext}`
  let counter = 2
  const existingSet = new Set(existingNames)
  while (existingSet.has(candidate)) {
    candidate = `${base} (copy ${counter})${ext}`
    counter++
  }
  return candidate
}

interface FileRowProps {
  file: FileItem
  paneId: string
  hostId: string
  hostAddress?: string
  hostPort?: number
  hostUsername?: string
  selectedFiles: Set<string>
  files: FileItem[]
  renamingPath: string | null
  renameValue: string
  renameInputRef: React.RefObject<HTMLInputElement>
  commitRename: () => void
  setRenamingPath: (path: string | null) => void
  setRenameValue: (value: string) => void
  onDoubleClick: () => void
  onSelect: (name: string, ctrl: boolean, shift: boolean, files: FileItem[]) => void
  sortedFiles: FileItem[]
  onContextMenu: (e: React.MouseEvent, file?: FileItem) => void
  getFileIcon: (file: FileItem) => React.ReactNode
  formatSize: (size: number) => string
  formatDate: (date: string) => string
}

function FileTableRow({
  file, paneId, hostId, hostAddress, hostPort, hostUsername,
  selectedFiles, files, renamingPath, renameValue, renameInputRef,
  commitRename, setRenamingPath, setRenameValue,
  onDoubleClick, onSelect, sortedFiles, onContextMenu,
  getFileIcon, formatSize, formatDate,
}: FileRowProps) {
  const draggable = useDraggable({
    id: `file-drag-${paneId}-${file.path}`,
    data: {
      type: 'file-drag',
      paneId,
      hostId,
      files: selectedFiles.has(file.name) ? files.filter((f) => selectedFiles.has(f.name)) : [file],
      sourceDirect: hostId.startsWith('direct_') ? { host: hostAddress, port: hostPort, username: hostUsername } : undefined,
    },
  })
  const droppable = useDroppable({
    id: `file-drop-${paneId}-${file.path}`,
    data: { type: 'file-drop', paneId, hostId, path: file.path },
    disabled: file.type !== 'directory',
    collisionDetector: pointerIntersection,
    collisionPriority: CollisionPriority.High,
  })
  const mergedRef = useCallback((node: HTMLTableRowElement | null) => {
    draggable.ref(node)
    droppable.ref(node)
  }, [draggable.ref, droppable.ref])

  return (
    <tr
      ref={mergedRef}
      onDoubleClick={onDoubleClick}
      onClick={(e) => onSelect(file.name, e.ctrlKey || e.metaKey, e.shiftKey, sortedFiles)}
      onContextMenu={(e) => onContextMenu(e, file)}
      className={`border-t border-dark-800 hover:bg-dark-800/50 cursor-pointer select-none ${
        droppable.isDropTarget ? 'bg-primary-600/20 ring-1 ring-inset ring-primary-500/50' : ''
      } ${selectedFiles.has(file.name) ? 'bg-primary-600/15' : ''}`}
    >
      <td className="p-2">{getFileIcon(file)}</td>
      <td className="p-2 text-white text-sm">
        {renamingPath === file.path ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenamingPath(null)
            }}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            className="bg-dark-800 border border-primary-500 rounded px-1 py-0.5 text-sm text-white w-full focus:outline-none"
          />
        ) : (
          <span className={file.type === 'directory' ? 'text-primary-400' : ''}>{file.name}</span>
        )}
      </td>
      <td className="p-2 text-dark-300 text-sm">{file.type === 'directory' ? '-' : formatSize(file.size)}</td>
      <td className="p-2 text-dark-300 font-mono text-xs">{file.permissions}</td>
      <td className="p-2 text-dark-300 text-sm">{formatDate(file.modifiedAt)}</td>
    </tr>
  )
}

function FileGridItem({
  file, paneId, hostId, hostAddress, hostPort, hostUsername,
  selectedFiles, files, renamingPath, renameValue, renameInputRef,
  commitRename, setRenamingPath, setRenameValue,
  onDoubleClick, onSelect, sortedFiles, onContextMenu,
  getFileIcon, formatSize,
}: FileRowProps) {
  const draggable = useDraggable({
    id: `file-drag-${paneId}-${file.path}`,
    data: {
      type: 'file-drag',
      paneId,
      hostId,
      files: selectedFiles.has(file.name) ? files.filter((f) => selectedFiles.has(f.name)) : [file],
      sourceDirect: hostId.startsWith('direct_') ? { host: hostAddress, port: hostPort, username: hostUsername } : undefined,
    },
  })
  const droppable = useDroppable({
    id: `file-drop-${paneId}-${file.path}`,
    data: { type: 'file-drop', paneId, hostId, path: file.path },
    disabled: file.type !== 'directory',
    collisionDetector: pointerIntersection,
    collisionPriority: CollisionPriority.High,
  })
  const mergedRef = useCallback((node: HTMLDivElement | null) => {
    draggable.ref(node)
    droppable.ref(node)
  }, [draggable.ref, droppable.ref])

  return (
    <div
      ref={mergedRef}
      onDoubleClick={onDoubleClick}
      onClick={(e) => onSelect(file.name, e.ctrlKey || e.metaKey, e.shiftKey, sortedFiles)}
      onContextMenu={(e) => onContextMenu(e, file)}
      className={`p-3 rounded-lg cursor-pointer select-none flex flex-col items-center text-center transition-colors ${
        droppable.isDropTarget ? 'bg-primary-600/20 ring-1 ring-inset ring-primary-500/50' : ''
      } ${selectedFiles.has(file.name) ? 'bg-primary-600/15 border border-primary-500/50' : 'bg-dark-800 hover:bg-dark-700'}`}
    >
      {getFileIcon(file)}
      {renamingPath === file.path ? (
        <input
          ref={renameInputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') setRenamingPath(null)
          }}
          onBlur={commitRename}
          onClick={(e) => e.stopPropagation()}
          className="bg-dark-800 border border-primary-500 rounded px-1 py-0.5 text-xs text-white w-full mt-2 text-center focus:outline-none"
        />
      ) : (
        <div className="text-white text-xs mt-2 truncate w-full">{file.name}</div>
      )}
      <div className="text-dark-400 text-xs mt-1">{file.type === 'directory' ? '-' : formatSize(file.size)}</div>
    </div>
  )
}

const extColors: Record<string, string> = {
  'js': 'text-yellow-400',
  'ts': 'text-blue-400',
  'tsx': 'text-blue-400',
  'jsx': 'text-blue-400',
  'json': 'text-green-400',
  'md': 'text-purple-400',
  'py': 'text-green-400',
  'go': 'text-cyan-400',
  'rs': 'text-orange-400',
  'css': 'text-pink-400',
  'html': 'text-orange-300',
  'sh': 'text-green-300',
  'yaml': 'text-pink-400',
  'yml': 'text-pink-400',
  'conf': 'text-dark-300',
  'log': 'text-dark-400',
  'txt': 'text-dark-300',
  'png': 'text-purple-400',
  'jpg': 'text-purple-400',
  'svg': 'text-purple-300',
  'pdf': 'text-red-400',
  'zip': 'text-yellow-400',
}
