import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Modal from '../ui/Modal'

interface FilePreviewProps {
  hostId: string
  filePath: string
  fileName: string
  onClose: () => void
}

export default function FilePreview({
  hostId,
  filePath,
  fileName,
  onClose,
}: FilePreviewProps) {
  const [content, setContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState<string>('')

  useEffect(() => {
    loadFile()
  }, [filePath])

  const loadFile = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.readFile(hostId, filePath)
      setContent(result.content)
      setEditContent(result.content)
    } catch (err: any) {
      setError(err.message || 'Failed to read file')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      await api.writeFile(hostId, filePath, editContent)
      setContent(editContent)
      setIsEditing(false)
    } catch (err: any) {
      setError(err.message || 'Failed to save file')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setEditContent(content)
    setIsEditing(false)
  }

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(content)
  }

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const getFileExtension = (name: string) => {
    return name.split('.').pop()?.toLowerCase() || ''
  }

  const isTextFile = () => {
    const textExtensions = [
      'txt',
      'md',
      'json',
      'yaml',
      'yml',
      'toml',
      'xml',
      'js',
      'ts',
      'jsx',
      'tsx',
      'py',
      'rb',
      'go',
      'rs',
      'java',
      'sh',
      'bash',
      'zsh',
      'fish',
      'ps1',
      'bat',
      'cmd',
      'html',
      'css',
      'scss',
      'less',
      'sql',
      'csv',
      'log',
      'conf',
      'cfg',
      'ini',
      'env',
      'gitignore',
      'dockerignore',
      'editorconfig',
    ]
    const ext = getFileExtension(fileName)
    return textExtensions.includes(ext) || fileName.startsWith('.')
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-dark-900 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 text-primary-500"
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
            <div>
              <h3 className="text-white font-medium">{fileName}</h3>
              <p className="text-dark-400 text-sm">{filePath}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isTextFile() && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg text-sm"
              >
                Edit
              </button>
            )}
            <button
              onClick={handleCopyToClipboard}
              className="bg-dark-700 hover:bg-dark-600 text-white px-3 py-1.5 rounded-lg text-sm"
            >
              Copy
            </button>
            <button
              onClick={handleDownload}
              className="bg-dark-700 hover:bg-dark-600 text-white px-3 py-1.5 rounded-lg text-sm"
            >
              Download
            </button>
            <button
              onClick={onClose}
              className="text-dark-400 hover:text-white p-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-dark-400">
              Loading...
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-red-500">
              {error}
            </div>
          ) : isEditing ? (
            <div className="h-full flex flex-col">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 bg-dark-800 text-white p-4 font-mono text-sm resize-none focus:outline-none"
                spellCheck={false}
              />
              <div className="p-3 border-t border-dark-700 flex justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-dark-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <pre className="h-full overflow-auto p-4 font-mono text-sm text-dark-300 bg-dark-800">
              {content}
            </pre>
          )}
        </div>
      </div>
    </Modal>
  )
}
