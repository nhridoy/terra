import { useRef } from 'react'

interface ModalProps {
  open?: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxWidth?: string
}

export default function Modal({
  open = true,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  if (!open) return null

  return (
    // biome-ignore lint/a11y/useSemanticElements: modal backdrop overlay
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
      onKeyDown={(e) => {
        if (
          (e.key === 'Enter' || e.key === ' ') &&
          e.target === overlayRef.current
        ) {
          e.preventDefault()
          onClose()
        }
      }}
    >
      <div
        className={`bg-dark-900 rounded-xl shadow-xl w-full ${maxWidth} max-h-[90vh] flex flex-col`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700 shrink-0">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-dark-400 hover:text-white text-xl leading-none"
            >
              &times;
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}
