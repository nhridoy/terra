import { useHostStore } from '../../stores/hostStore'

interface HostDetailsProps {
  host: any
  onConnect: (host: any) => void
  onEdit: (host: any) => void
  onDelete: (id: string) => void
}

export default function HostDetails({ host, onConnect, onEdit, onDelete }: HostDetailsProps) {
  const { groups } = useHostStore()
  const groupName = host.groupId ? groups.find((g) => g.id === host.groupId)?.name : null
  const handleSftpClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm(`Delete host "${host.name}"?`)) {
      onDelete(host.id)
    }
  }

  return (
    <>
      <div
        onClick={() => onConnect(host)}
        className="flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer hover:bg-dark-800 group transition-colors"
      >
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: host.color || '#64748b' }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white text-sm font-medium truncate">{host.name}</p>
            {groupName && (
              <span className="px-1.5 py-0.5 text-xs bg-dark-700 text-dark-300 rounded">
                {groupName}
              </span>
            )}
          </div>
          <p className="text-dark-400 text-xs truncate">
            {host.username}@{host.address}:{host.port}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleSftpClick}
            className="p-1.5 text-dark-400 hover:text-primary-500 rounded hover:bg-dark-700"
            title="Open SFTP"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(host); }}
            className="p-1.5 text-dark-400 hover:text-yellow-500 rounded hover:bg-dark-700"
            title="Edit host"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 text-dark-400 hover:text-red-500 rounded hover:bg-dark-700"
            title="Delete host"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v12m-6 0h14m-6 0h.01" />
            </svg>
          </button>
        </div>
      </div>

      {/* SFTP Modal */}
      {/* SFTP view would be handled by the parent Layout component */}
    </>
  )
}