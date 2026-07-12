import { useEffect, useState } from 'react'
import api from '../../lib/api'

interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory' | 'symlink'
  size: number
  permissions: string
  owner: string
  group: string
  modifiedAt: string
  isHidden: boolean
}

interface FileBrowserProps {
  hostId: string
  onFileSelect?: (file: FileItem) => void
}

export default function FileBrowser({
  hostId,
  onFileSelect,
}: FileBrowserProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [currentPath, setCurrentPath] = useState('/')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [showHidden, setShowHidden] = useState(false)
  const [sortField, setSortField] = useState<keyof FileItem>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    loadDirectory(currentPath)
  }, [hostId, currentPath])

  const loadDirectory = async (path: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.listFiles(hostId, path)
      setFiles(result.files)
    } catch (err: any) {
      setError(err.message || 'Failed to load directory')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDoubleClick = (file: FileItem) => {
    if (file.type === 'directory') {
      setCurrentPath(file.path)
    } else if (onFileSelect) {
      onFileSelect(file)
    }
  }

  const handleSelect = (fileName: string, isMultiSelect: boolean) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(isMultiSelect ? prev : [])
      if (newSet.has(fileName)) {
        newSet.delete(fileName)
      } else {
        newSet.add(fileName)
      }
      return newSet
    })
  }

  const handleUpload = async (fileList: FileList) => {
    setIsLoading(true)
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        const reader = new FileReader()
        reader.onload = async () => {
          const content = reader.result as string
          await api.uploadFile(hostId, currentPath, file.name, content)
        }
        reader.readAsText(file)
      }
      loadDirectory(currentPath)
    } catch (err: any) {
      setError(err.message || 'Failed to upload file')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async (file: FileItem) => {
    try {
      const result = await api.readFile(hostId, file.path)
      const blob = new Blob([result.content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || 'Failed to download file')
    }
  }

  const handleDelete = async (file: FileItem) => {
    if (confirm(`Are you sure you want to delete ${file.name}?`)) {
      setIsLoading(true)
      try {
        await api.deleteFile(hostId, file.path)
        loadDirectory(currentPath)
      } catch (err: any) {
        setError(err.message || 'Failed to delete file')
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleRename = async (file: FileItem) => {
    const newName = prompt('Enter new name:', file.name)
    if (newName && newName !== file.name) {
      setIsLoading(true)
      try {
        const newPath = currentPath + '/' + newName
        await api.moveFile(hostId, file.path, newPath)
        loadDirectory(currentPath)
      } catch (err: any) {
        setError(err.message || 'Failed to rename file')
      } finally {
        setIsLoading(false)
      }
    }
  }

  const sortedFiles = [...files]
    .filter((f) => showHidden || !f.isHidden)
    .sort((a, b) => {
      // Directories first
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      let comparison = 0
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'size':
          comparison = a.size - b.size
          break
        case 'modifiedAt':
          comparison =
            new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()
          break
        case 'permissions':
          comparison = a.permissions.localeCompare(b.permissions)
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (
      Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    )
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
        <svg
          className="w-5 h-5 text-yellow-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      )
    }
    return (
      <svg
        className="w-5 h-5 text-dark-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    )
  }

  return (
    <div className="h-full flex flex-col bg-dark-900">
      {/* Toolbar */}
      <div className="p-3 border-b border-dark-700">
        <div className="flex items-center gap-3 mb-3">
          {/* Breadcrumb path */}
          <div className="flex-1 flex items-center gap-1 bg-dark-800 px-3 py-2 rounded-lg overflow-x-auto">
            {currentPath
              .split('/')
              .filter(Boolean)
              .map((part, i, arr) => (
                <span key={i} className="flex items-center">
                  <button
                    onClick={() =>
                      setCurrentPath('/' + arr.slice(0, i + 1).join('/'))
                    }
                    className="text-primary-400 hover:text-primary-300 text-sm whitespace-nowrap"
                  >
                    {part}
                  </button>
                  {i < arr.length - 1 && (
                    <span className="text-dark-500 mx-1">/</span>
                  )}
                </span>
              ))}
            {currentPath === '/' && (
              <span className="text-dark-400 text-sm">/</span>
            )}
          </div>

          {/* Up button */}
          <button
            onClick={() => {
              const parent =
                currentPath.split('/').slice(0, -1).join('/') || '/'
              setCurrentPath(parent)
            }}
            className="p-2 bg-dark-700 hover:bg-dark-600 rounded-lg"
            title="Go up"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
          </button>

          {/* Home button */}
          <button
            onClick={() => setCurrentPath('/')}
            className="p-2 bg-dark-700 hover:bg-dark-600 rounded-lg"
            title="Go to home"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          </button>

          {/* Refresh button */}
          <button
            onClick={() => loadDirectory(currentPath)}
            className="p-2 bg-dark-700 hover:bg-dark-600 rounded-lg"
            title="Refresh"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Upload button */}
          <label className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg text-sm cursor-pointer">
            Upload
            <input
              type="file"
              className="hidden"
              multiple
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
          </label>

          {/* New folder button */}
          <button
            onClick={async () => {
              const name = prompt('Enter folder name:')
              if (name) {
                setIsLoading(true)
                try {
                  await api.createDirectory(hostId, currentPath, name)
                  loadDirectory(currentPath)
                } catch (err: any) {
                  setError(err.message || 'Failed to create folder')
                } finally {
                  setIsLoading(false)
                }
              }
            }}
            className="bg-dark-700 hover:bg-dark-600 text-white px-3 py-1.5 rounded-lg text-sm"
          >
            New Folder
          </button>

          {/* Show hidden files */}
          <label className="flex items-center gap-2 text-dark-400 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
              className="rounded bg-dark-700 border-dark-600 text-primary-500 focus:ring-primary-500"
            />
            Show hidden
          </label>

          {/* View mode toggle */}
          <div className="flex bg-dark-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 ${viewMode === 'list' ? 'bg-primary-600' : 'hover:bg-dark-600'}`}
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 ${viewMode === 'grid' ? 'bg-primary-600' : 'hover:bg-dark-600'}`}
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-300 hover:text-red-200"
          >
            ×
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="p-3 text-center text-dark-400">Loading...</div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {!isLoading && sortedFiles.length === 0 ? (
          <div className="text-center text-dark-400 py-12">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-dark-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <p>Empty directory</p>
          </div>
        ) : viewMode === 'list' ? (
          <table className="w-full">
            <thead className="bg-dark-800 sticky top-0">
              <tr className="text-left text-dark-400 text-sm">
                <th className="p-3 w-8"></th>
                <th className="p-3">
                  <button
                    onClick={() => {
                      setSortField('name')
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    }}
                    className="flex items-center gap-1 hover:text-white"
                  >
                    Name
                    {sortField === 'name' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="p-3 w-24">
                  <button
                    onClick={() => {
                      setSortField('size')
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    }}
                    className="flex items-center gap-1 hover:text-white"
                  >
                    Size
                    {sortField === 'size' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="p-3 w-32">
                  <button
                    onClick={() => {
                      setSortField('permissions')
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    }}
                    className="flex items-center gap-1 hover:text-white"
                  >
                    Permissions
                    {sortField === 'permissions' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="p-3 w-40">
                  <button
                    onClick={() => {
                      setSortField('modifiedAt')
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                    }}
                    className="flex items-center gap-1 hover:text-white"
                  >
                    Modified
                    {sortField === 'modifiedAt' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="p-3 w-24">Actions</th>
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
                  className={`border-t border-dark-700 hover:bg-dark-800 cursor-pointer ${
                    selectedFiles.has(file.name) ? 'bg-primary-600/20' : ''
                  }`}
                >
                  <td className="p-3">{getFileIcon(file)}</td>
                  <td className="p-3 text-white">{file.name}</td>
                  <td className="p-3 text-dark-300 text-sm">
                    {formatSize(file.size)}
                  </td>
                  <td className="p-3 text-dark-300 font-mono text-sm">
                    {file.permissions}
                  </td>
                  <td className="p-3 text-dark-300 text-sm">
                    {formatDate(file.modifiedAt)}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {file.type === 'file' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownload(file)
                          }}
                          className="p-1 text-dark-400 hover:text-primary-500"
                          title="Download"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRename(file)
                        }}
                        className="p-1 text-dark-400 hover:text-yellow-500"
                        title="Rename"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(file)
                        }}
                        className="p-1 text-dark-400 hover:text-red-500"
                        title="Delete"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="grid grid-cols-4 gap-4 p-4">
            {sortedFiles.map((file) => (
              <div
                key={file.path}
                onDoubleClick={() => handleDoubleClick(file)}
                onClick={(e) => handleSelect(file.name, e.ctrlKey || e.metaKey)}
                className={`p-4 rounded-lg cursor-pointer ${
                  selectedFiles.has(file.name)
                    ? 'bg-primary-600/20 border border-primary-500/50'
                    : 'bg-dark-800 hover:bg-dark-700'
                }`}
              >
                <div className="flex flex-col items-center text-center">
                  {getFileIcon(file)}
                  <div className="text-white text-sm mt-2 truncate w-full">
                    {file.name}
                  </div>
                  <div className="text-dark-400 text-xs mt-1">
                    {formatSize(file.size)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="p-2 border-t border-dark-700 text-dark-400 text-sm flex justify-between">
        <span>{sortedFiles.length} items</span>
        {selectedFiles.size > 0 && <span>{selectedFiles.size} selected</span>}
      </div>
    </div>
  )
}
