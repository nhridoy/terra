import { useState } from 'react'
import FileBrowser from './FileBrowser'
import FilePreview from './FilePreview'
import FileTransfer from './FileTransfer'

interface SftpViewProps {
  hostId: string
  hostName: string
}

export default function SftpView({ hostId, hostName }: SftpViewProps) {
  const [selectedFile, setSelectedFile] = useState<{
    path: string
    name: string
  } | null>(null)

  return (
    <div className="h-full flex flex-col bg-dark-900">
      {/* Header */}
      <div className="p-4 border-b border-dark-700">
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
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-white">SFTP Browser</h2>
            <p className="text-dark-400 text-sm">{hostName}</p>
          </div>
        </div>
      </div>

      {/* File Browser */}
      <div className="flex-1 overflow-hidden">
        <FileBrowser
          hostId={hostId}
          onFileSelect={(file) =>
            setSelectedFile({ path: file.path, name: file.name })
          }
        />
      </div>

      {/* File Transfer Progress */}
      <FileTransfer />

      {/* File Preview Modal */}
      {selectedFile && (
        <FilePreview
          hostId={hostId}
          filePath={selectedFile.path}
          fileName={selectedFile.name}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  )
}
