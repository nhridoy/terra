import { useState } from 'react'
import { defaultShortcuts } from '../../hooks/useKeyboardShortcuts'
import Modal from '../ui/Modal'

interface KeyboardSettingsProps {
  onClose: () => void
}

export default function KeyboardSettings({ onClose }: KeyboardSettingsProps) {
  const [shortcuts, setShortcuts] = useState(defaultShortcuts)
  const [editingId, setEditingId] = useState<string | null>(null)

  const categories = [...new Set(shortcuts.map((s) => s.category))]

  const handleReset = () => {
    setShortcuts(defaultShortcuts)
  }

  const getKeyDisplay = (keys: string) => {
    return keys
      .replace('Ctrl', navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')
      .replace('Alt', navigator.platform.includes('Mac') ? '⌥' : 'Alt')
      .replace('Shift', navigator.platform.includes('Mac') ? '⇧' : 'Shift')
      .replace('+', ' ')
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-dark-900 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-dark-700 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">
            Keyboard Shortcuts
          </h3>
          <button onClick={onClose} className="text-dark-400 hover:text-white">
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {categories.map((category) => (
            <div key={category} className="mb-6">
              <h4 className="text-dark-400 text-sm font-medium mb-3 uppercase tracking-wider">
                {category}
              </h4>
              <div className="space-y-2">
                {shortcuts
                  .filter((s) => s.category === category)
                  .map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between p-3 bg-dark-800 rounded-lg hover:bg-dark-700"
                    >
                      <div>
                        <div className="text-white text-sm">
                          {shortcut.description}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingId === shortcut.id ? (
                          <input
                            type="text"
                            value={shortcut.keys}
                            onChange={(e) => {
                              setShortcuts(
                                shortcuts.map((s) =>
                                  s.id === shortcut.id
                                    ? { ...s, keys: e.target.value }
                                    : s,
                                ),
                              )
                            }}
                            onBlur={() => setEditingId(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setEditingId(null)
                              }
                            }}
                            className="bg-dark-700 text-white px-2 py-1 rounded text-sm w-32"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => setEditingId(shortcut.id)}
                            className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded text-sm text-dark-300 hover:text-white font-mono"
                          >
                            {getKeyDisplay(shortcut.keys)}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-700 flex justify-between">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-dark-400 hover:text-white"
          >
            Reset to defaults
          </button>
          <button
            onClick={onClose}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}
