import {
  ArrowSquareOut,
  ArrowsClockwise,
  ArrowUp,
  File,
  Folder,
  GridFour,
  House,
  ListDashes,
  MagnifyingGlass,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react'
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createLocalDir,
  isTauriAvailable,
  listLocalFiles,
  readLocalFile,
  removeLocalFile,
  renameLocalFile,
} from '../../lib/localFs'
import type {
  FileItem,
  FileSortDirection,
  FileSortField,
  FileViewMode,
} from '../../lib/sftpTypes'
import ContextMenu, { type ContextMenuItem } from '../ui/ContextMenu'
import { toast } from '../ui/Toast'

interface LocalFileBrowserProps {
  rootPath: string
}

export default function LocalFileBrowser({ rootPath }: LocalFileBrowserProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [currentPath, setCurrentPath] = useState(rootPath)
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
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    file: FileItem
  } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const loadDirectory = useCallback(async (path: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await listLocalFiles(path)
      setFiles(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load directory')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDirectory(currentPath)
    setPathInput(currentPath)
  }, [currentPath, loadDirectory])

  useEffect(() => {
    if (renamingPath && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingPath])

  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path)
    setSelectedFiles(new Set())
    setSearchQuery('')
  }, [])

  const navigateUp = useCallback(() => {
    const sep = currentPath.includes('\\') ? '\\' : '/'
    const parts = currentPath.split(sep)
    parts.pop()
    navigateTo(parts.join(sep) || sep)
  }, [currentPath, navigateTo])

  const handleDoubleClick = (file: FileItem) => {
    if (file.type === 'directory') {
      navigateTo(file.path)
    }
  }

  const handleSelect = (fileName: string, isMultiSelect: boolean) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(isMultiSelect ? prev : [])
      if (newSet.has(fileName)) newSet.delete(fileName)
      else newSet.add(fileName)
      return newSet
    })
  }

  const handleNewFolder = async () => {
    const name = window.prompt('Enter folder name:')
    if (!name) return
    const sep = currentPath.includes('\\') ? '\\' : '/'
    try {
      await createLocalDir(currentPath + sep + name)
      toast(`Created folder ${name}`, 'success')
      loadDirectory(currentPath)
    } catch (err: unknown) {
      toast(
        `Failed to create folder: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      )
    }
  }

  const handleDelete = async (file: FileItem) => {
    if (
      !(await tauriConfirm(`Delete "${file.name}"?`, {
        title: 'Delete File',
        kind: 'warning',
      }))
    )
      return
    try {
      await removeLocalFile(file.path)
      toast(`Deleted ${file.name}`, 'success')
      loadDirectory(currentPath)
    } catch (err: unknown) {
      toast(
        `Failed to delete ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      )
    }
  }

  const startRename = useCallback((file: FileItem) => {
    setRenamingPath(file.path)
    setRenameValue(file.name)
  }, [])

  const commitRename = async () => {
    if (!renamingPath) return
    const file = files.find((f) => f.path === renamingPath)
    if (!file || renameValue === file.name || !renameValue.trim()) {
      setRenamingPath(null)
      return
    }
    const sep = currentPath.includes('\\') ? '\\' : '/'
    const newPath = currentPath + sep + renameValue.trim()
    try {
      await renameLocalFile(file.path, newPath)
      toast(`Renamed to ${renameValue.trim()}`, 'success')
      loadDirectory(currentPath)
    } catch (err: unknown) {
      toast(
        `Failed to rename: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      )
    } finally {
      setRenamingPath(null)
    }
  }

  const handleDownload = async (file: FileItem) => {
    try {
      const content = await readLocalFile(file.path)
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      URL.revokeObjectURL(url)
      toast(`Saved ${file.name}`, 'success')
    } catch (err: unknown) {
      toast(
        `Failed to read ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      )
    }
  }

  // Drag & drop from desktop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === containerRef.current) setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    // Native file drops from desktop are handled by the OS, not Tauri fs
    // For now, just show a toast
    if (e.dataTransfer.files.length > 0) {
      toast(
        'Drag-and-drop from desktop to local filesystem is not yet supported',
        'info',
      )
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 'F2' && selectedFiles.size === 1) {
        e.preventDefault()
        const name = [...selectedFiles][0]
        const file = files.find((f) => f.name === name)
        if (file) startRename(file)
      } else if (e.key === 'F5') {
        e.preventDefault()
        loadDirectory(currentPath)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        navigateUp()
      } else if (e.key === 'Escape') {
        setSelectedFiles(new Set())
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [
    selectedFiles,
    files,
    currentPath,
    startRename,
    navigateUp,
    loadDirectory,
  ])

  const sortedFiles = useMemo(() => {
    return [...files]
      .filter(
        (f) =>
          (showHidden || !f.isHidden) &&
          (searchQuery === '' ||
            f.name.toLowerCase().includes(searchQuery.toLowerCase())),
      )
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        let cmp = 0
        if (sortField === 'name') cmp = a.name.localeCompare(b.name)
        else if (sortField === 'size') cmp = a.size - b.size
        else if (sortField === 'permissions')
          cmp = a.permissions.localeCompare(b.permissions)
        else if (sortField === 'modifiedAt')
          cmp =
            new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()
        return sortDirection === 'asc' ? cmp : -cmp
      })
  }, [files, showHidden, searchQuery, sortField, sortDirection])

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getFileIcon = (file: FileItem) => {
    if (file.type === 'directory') {
      return (
        <Folder
          className="w-5 h-5 text-yellow-500 flex-shrink-0"
          weight="bold"
        />
      )
    }
    return (
      <File className="w-5 h-5 text-dark-400 flex-shrink-0" weight="bold" />
    )
  }

  const handleContextMenu = (e: React.MouseEvent, file: FileItem) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selectedFiles.has(file.name)) setSelectedFiles(new Set([file.name]))
    setContextMenu({ x: e.clientX, y: e.clientY, file })
  }

  const contextMenuItems: ContextMenuItem[] = contextMenu
    ? [
        ...(contextMenu.file.type === 'file'
          ? [
              {
                label: 'Open',
                icon: <ArrowSquareOut className="w-4 h-4" weight="bold" />,
                onClick: () => handleDownload(contextMenu.file),
              },
            ]
          : []),
        {
          label: 'Rename',
          icon: <PencilSimple className="w-4 h-4" weight="bold" />,
          shortcut: 'F2',
          onClick: () => startRename(contextMenu.file),
        },
        { type: 'separator' as const },
        {
          label: 'Delete',
          icon: <Trash className="w-4 h-4" weight="bold" />,
          shortcut: 'Del',
          danger: true,
          onClick: () => handleDelete(contextMenu.file),
        },
      ]
    : []

  const handlePathKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      navigateTo(pathInput)
    } else if (e.key === 'Escape') {
      setPathInput(currentPath)
    }
  }

  if (!isTauriAvailable()) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-dark-900 text-center px-6">
        <Folder className="w-16 h-16 mb-4 text-dark-600" weight="bold" />
        <p className="text-dark-300 text-sm mb-1">
          Local filesystem is only available in the desktop app
        </p>
        <p className="text-dark-500 text-xs">
          Run{' '}
          <code className="bg-dark-800 px-1.5 py-0.5 rounded">
            npm run tauri dev
          </code>{' '}
          to test locally
        </p>
      </div>
    )
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: main file browser container with drag-and-drop
    <div
      ref={containerRef}
      className="h-full flex flex-col bg-dark-900 relative"
      role="button"
      tabIndex={0}
      onKeyDown={() => {}}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-primary-600/20 border-2 border-dashed border-primary-500 rounded-lg flex items-center justify-center pointer-events-none">
          <p className="text-primary-300 text-lg font-medium">
            Drop files here
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="p-3 border-b border-dark-700">
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => navigateTo(rootPath)}
            className="p-1.5 hover:bg-dark-700 rounded"
            title="Root"
          >
            <House className="w-4 h-4 text-dark-300" weight="bold" />
          </button>
          <button
            type="button"
            onClick={navigateUp}
            className="p-1.5 hover:bg-dark-700 rounded"
            title="Up"
          >
            <ArrowUp className="w-4 h-4 text-dark-300" weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => loadDirectory(currentPath)}
            className="p-1.5 hover:bg-dark-700 rounded"
            title="Refresh"
          >
            <ArrowsClockwise className="w-4 h-4 text-dark-300" weight="bold" />
          </button>
          <input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={handlePathKeyDown}
            onBlur={() => setPathInput(currentPath)}
            className="flex-1 bg-dark-800 border border-dark-600 rounded px-2 py-1 text-sm text-white font-mono focus:border-primary-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleNewFolder}
            className="bg-dark-700 hover:bg-dark-600 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            New Folder
          </button>
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlass
              className="w-4 h-4 text-dark-400 absolute left-2 top-1/2 -translate-y-1/2"
              weight="bold"
            />
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
          <div className="flex bg-dark-700 rounded overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1 ${viewMode === 'list' ? 'bg-primary-600' : 'hover:bg-dark-600'}`}
            >
              <ListDashes className="w-4 h-4 text-white" weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1 ${viewMode === 'grid' ? 'bg-primary-600' : 'hover:bg-dark-600'}`}
            >
              <GridFour className="w-4 h-4 text-white" weight="bold" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-300 hover:text-red-200"
          >
            &times;
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex-1 p-3 space-y-1">
          {Array.from({ length: 8 }, (_, i) => `sk-${i}`).map((key) => (
            <div
              key={key}
              className="flex items-center gap-3 p-2 animate-pulse"
            >
              <div className="w-5 h-5 bg-dark-700 rounded" />
              <div
                className="h-3 bg-dark-700 rounded flex-1"
                style={{ width: `${40 + Math.random() * 40}%` }}
              />
            </div>
          ))}
        </div>
      )}

      {!isLoading && sortedFiles.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-dark-400">
          <Folder className="w-16 h-16 mb-3 text-dark-600" weight="bold" />
          <p>{searchQuery ? 'No matching files' : 'Empty directory'}</p>
        </div>
      )}

      {!isLoading && sortedFiles.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'list' ? (
            <table className="w-full">
              <thead className="bg-dark-800 sticky top-0">
                <tr className="text-left text-dark-400 text-xs">
                  <th className="p-2 w-8" />
                  <th className="p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSortField('name')
                        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
                      }}
                      className="flex items-center gap-1 hover:text-white"
                    >
                      Name{' '}
                      {sortField === 'name' &&
                        (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="p-2 w-20">
                    <button
                      type="button"
                      onClick={() => {
                        setSortField('size')
                        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
                      }}
                      className="flex items-center gap-1 hover:text-white"
                    >
                      Size{' '}
                      {sortField === 'size' &&
                        (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="p-2 w-36">
                    <button
                      type="button"
                      onClick={() => {
                        setSortField('modifiedAt')
                        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
                      }}
                      className="flex items-center gap-1 hover:text-white"
                    >
                      Modified{' '}
                      {sortField === 'modifiedAt' &&
                        (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedFiles.map((file) => (
                  <tr
                    key={file.path}
                    onDoubleClick={() => handleDoubleClick(file)}
                    onClick={(e) =>
                      handleSelect(file.name, e.ctrlKey || e.metaKey)
                    }
                    onContextMenu={(e) => handleContextMenu(e, file)}
                    className={`border-t border-dark-800 hover:bg-dark-800/50 cursor-pointer select-none ${selectedFiles.has(file.name) ? 'bg-primary-600/15' : ''}`}
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
                        <span
                          className={
                            file.type === 'directory' ? 'text-primary-400' : ''
                          }
                        >
                          {file.name}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-dark-300 text-sm">
                      {file.type === 'directory' ? '-' : formatSize(file.size)}
                    </td>
                    <td className="p-2 text-dark-300 text-sm">
                      {formatDate(file.modifiedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 p-3">
              {sortedFiles.map((file) => (
                <button
                  key={file.path}
                  type="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ')
                      handleDoubleClick(file)
                  }}
                  onDoubleClick={() => handleDoubleClick(file)}
                  onClick={(e) =>
                    handleSelect(file.name, e.ctrlKey || e.metaKey)
                  }
                  onContextMenu={(e) => handleContextMenu(e, file)}
                  className={`p-3 rounded-lg cursor-pointer select-none flex flex-col items-center text-center transition-colors ${selectedFiles.has(file.name) ? 'bg-primary-600/15 border border-primary-500/50' : 'bg-dark-800 hover:bg-dark-700'}`}
                >
                  {getFileIcon(file)}
                  <div className="text-white text-xs mt-2 truncate w-full">
                    {file.name}
                  </div>
                  <div className="text-dark-400 text-xs mt-1">
                    {file.type === 'directory' ? '-' : formatSize(file.size)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="px-3 py-1.5 border-t border-dark-700 text-dark-400 text-xs flex justify-between">
        <span>
          {sortedFiles.length} item{sortedFiles.length !== 1 ? 's' : ''}
        </span>
        {selectedFiles.size > 0 && <span>{selectedFiles.size} selected</span>}
      </div>

      {contextMenu && (
        <ContextMenu
          items={contextMenuItems}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
