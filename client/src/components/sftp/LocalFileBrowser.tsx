import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  listLocalFiles,
  readLocalFile,
  createLocalDir,
  removeLocalFile,
  renameLocalFile,
  isTauriAvailable,
} from '../../lib/localFs'
import type { FileItem, FileSortDirection, FileSortField, FileViewMode } from '../../lib/sftpTypes'
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileItem } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadDirectory(currentPath)
    setPathInput(currentPath)
  }, [currentPath])

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
      const result = await listLocalFiles(path)
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
    const sep = currentPath.includes('\\') ? '\\' : '/'
    const parts = currentPath.split(sep)
    parts.pop()
    navigateTo(parts.join(sep) || sep)
  }

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
      toast(`Failed to create folder: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    }
  }

  const handleDelete = async (file: FileItem) => {
    try {
      await removeLocalFile(file.path)
      toast(`Deleted ${file.name}`, 'success')
      loadDirectory(currentPath)
    } catch (err: unknown) {
      toast(`Failed to delete ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
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
    const sep = currentPath.includes('\\') ? '\\' : '/'
    const newPath = currentPath + sep + renameValue.trim()
    try {
      await renameLocalFile(file.path, newPath)
      toast(`Renamed to ${renameValue.trim()}`, 'success')
      loadDirectory(currentPath)
    } catch (err: unknown) {
      toast(`Failed to rename: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
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
      toast(`Failed to read ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
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
      toast('Drag-and-drop from desktop to local filesystem is not yet supported', 'info')
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
  }, [selectedFiles, files, currentPath])

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
    return (
      <svg className="w-5 h-5 text-dark-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }

  const handleContextMenu = (e: React.MouseEvent, file: FileItem) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selectedFiles.has(file.name)) setSelectedFiles(new Set([file.name]))
    setContextMenu({ x: e.clientX, y: e.clientY, file })
  }

  const contextMenuItems: ContextMenuItem[] = contextMenu ? [
    ...(contextMenu.file.type === 'file' ? [{
      label: 'Open',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
      onClick: () => handleDownload(contextMenu.file),
    }] : []),
    {
      label: 'Rename',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
      shortcut: 'F2',
      onClick: () => startRename(contextMenu.file),
    },
    { type: 'separator' as const },
    {
      label: 'Delete',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
      shortcut: 'Del',
      danger: true,
      onClick: () => handleDelete(contextMenu.file),
    },
  ] : []

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
        <svg className="w-16 h-16 mb-4 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <p className="text-dark-300 text-sm mb-1">Local filesystem is only available in the desktop app</p>
        <p className="text-dark-500 text-xs">Run <code className="bg-dark-800 px-1.5 py-0.5 rounded">npm run tauri dev</code> to test locally</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col bg-dark-900 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-primary-600/20 border-2 border-dashed border-primary-500 rounded-lg flex items-center justify-center pointer-events-none">
          <p className="text-primary-300 text-lg font-medium">Drop files here</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="p-3 border-b border-dark-700">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => navigateTo(rootPath)} className="p-1.5 hover:bg-dark-700 rounded" title="Root">
            <svg className="w-4 h-4 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
          <button onClick={navigateUp} className="p-1.5 hover:bg-dark-700 rounded" title="Up">
            <svg className="w-4 h-4 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
          <button onClick={() => loadDirectory(currentPath)} className="p-1.5 hover:bg-dark-700 rounded" title="Refresh">
            <svg className="w-4 h-4 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
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
          <button onClick={handleNewFolder} className="bg-dark-700 hover:bg-dark-600 text-white px-3 py-1 rounded text-sm transition-colors">
            New Folder
          </button>
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
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="rounded bg-dark-700 border-dark-600 text-primary-500 focus:ring-primary-500" />
            Hidden
          </label>
          <div className="flex bg-dark-700 rounded overflow-hidden">
            <button onClick={() => setViewMode('list')} className={`p-1 ${viewMode === 'list' ? 'bg-primary-600' : 'hover:bg-dark-600'}`}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            </button>
            <button onClick={() => setViewMode('grid')} className={`p-1 ${viewMode === 'grid' ? 'bg-primary-600' : 'hover:bg-dark-600'}`}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-red-200">&times;</button>
        </div>
      )}

      {isLoading && (
        <div className="flex-1 p-3 space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
              <div className="w-5 h-5 bg-dark-700 rounded" />
              <div className="h-3 bg-dark-700 rounded flex-1" style={{ width: `${40 + Math.random() * 40}%` }} />
            </div>
          ))}
        </div>
      )}

      {!isLoading && sortedFiles.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-dark-400">
          <svg className="w-16 h-16 mb-3 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
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
                    <button onClick={() => { setSortField('name'); setSortDirection((d) => d === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-1 hover:text-white">
                      Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="p-2 w-20">
                    <button onClick={() => { setSortField('size'); setSortDirection((d) => d === 'asc' ? 'desc' : 'asc') }} className="flex items-center gap-1 hover:text-white">
                      Size {sortField === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
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
                  <tr
                    key={file.path}
                    onDoubleClick={() => handleDoubleClick(file)}
                    onClick={(e) => handleSelect(file.name, e.ctrlKey || e.metaKey)}
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
                          onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingPath(null) }}
                          onBlur={commitRename}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-dark-800 border border-primary-500 rounded px-1 py-0.5 text-sm text-white w-full focus:outline-none"
                        />
                      ) : (
                        <span className={file.type === 'directory' ? 'text-primary-400' : ''}>{file.name}</span>
                      )}
                    </td>
                    <td className="p-2 text-dark-300 text-sm">{file.type === 'directory' ? '-' : formatSize(file.size)}</td>
                    <td className="p-2 text-dark-300 text-sm">{formatDate(file.modifiedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 p-3">
              {sortedFiles.map((file) => (
                <div
                  key={file.path}
                  onDoubleClick={() => handleDoubleClick(file)}
                  onClick={(e) => handleSelect(file.name, e.ctrlKey || e.metaKey)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                  className={`p-3 rounded-lg cursor-pointer select-none flex flex-col items-center text-center transition-colors ${selectedFiles.has(file.name) ? 'bg-primary-600/15 border border-primary-500/50' : 'bg-dark-800 hover:bg-dark-700'}`}
                >
                  {getFileIcon(file)}
                  <div className="text-white text-xs mt-2 truncate w-full">{file.name}</div>
                  <div className="text-dark-400 text-xs mt-1">{file.type === 'directory' ? '-' : formatSize(file.size)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="px-3 py-1.5 border-t border-dark-700 text-dark-400 text-xs flex justify-between">
        <span>{sortedFiles.length} item{sortedFiles.length !== 1 ? 's' : ''}</span>
        {selectedFiles.size > 0 && <span>{selectedFiles.size} selected</span>}
      </div>

      {contextMenu && (
        <ContextMenu items={contextMenuItems} x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} />
      )}
    </div>
  )
}
