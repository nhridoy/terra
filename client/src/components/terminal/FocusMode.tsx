import { X } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'

interface FocusModeProps {
  isActive: boolean
  onExit: () => void
  children: React.ReactNode
}

export default function FocusMode({
  isActive,
  onExit,
  children,
}: FocusModeProps) {
  const [showHint, setShowHint] = useState(true)

  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => setShowHint(false), 3000)
      return () => clearTimeout(timer)
    } else {
      setShowHint(true)
    }
  }, [isActive])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isActive && e.key === 'Escape') {
        onExit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, onExit])

  if (!isActive) {
    return <>{children}</>
  }

  return (
    <div className="fixed inset-0 z-50 bg-dark-950">
      {/* Full screen terminal */}
      <div className="h-full">{children}</div>

      {/* Exit hint */}
      {showHint && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-dark-800 text-dark-300 px-4 py-2 rounded-lg text-sm animate-pulse">
          Press{' '}
          <kbd className="px-1.5 py-0.5 bg-dark-700 rounded text-white">
            Esc
          </kbd>{' '}
          to exit focus mode
        </div>
      )}

      {/* Minimal exit button (top right, very subtle) */}
      <button
        type="button"
        onClick={onExit}
        className="absolute top-2 right-2 p-2 text-dark-600 hover:text-dark-400 opacity-20 hover:opacity-100 transition-opacity"
        title="Exit focus mode (Esc)"
      >
        <X className="w-5 h-5" weight="bold" />
      </button>
    </div>
  )
}
