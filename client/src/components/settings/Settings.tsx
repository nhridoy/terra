import { useState } from 'react'
import { type Theme, themes, useThemeStore } from '../../stores/themeStore'
import Modal from '../ui/Modal'

export default function Settings() {
  const { currentTheme, setTheme } = useThemeStore()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'themes' | 'terminal' | 'about'>(
    'themes',
  )
  const [searchQuery, setSearchQuery] = useState('')

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 bg-dark-700 hover:bg-dark-600 text-white p-3 rounded-full shadow-lg"
        title="Settings"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
    )
  }

  const filteredThemes = (Object.keys(themes) as Theme[]).filter((theme) =>
    themes[theme].name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const themeCategories = {
    popular: ['dark', 'light', 'dracula', 'nord', 'monokai', 'onedark'],
    'catppuccin-family': [
      'catppuccin',
      'tokyo-night',
      'rose-pine',
      'palenight',
    ],
    'solarized-family': ['solarized', 'ayu-mirage', 'material-ocean'],
    github: ['github-dark', 'github-light'],
    'gruvbox-family': ['gruvbox'],
    colorful: ['cyberpunk', 'neon', 'neon-pink', 'matrix', 'hacker'],
    nature: ['forest', 'ocean', 'sunset', 'arctic', 'volcanic'],
    other: ['midnight', 'retro', 'pastel', 'warm'],
  }

  return (
    <Modal
      open={isOpen}
      onClose={() => setIsOpen(false)}
      title="Settings"
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col" style={{ height: '70vh' }}>
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-dark-700 p-4 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('themes')}
              className={`w-full text-left px-3 py-2 rounded-lg mb-2 ${
                activeTab === 'themes'
                  ? 'bg-primary-600 text-white'
                  : 'text-dark-400 hover:bg-dark-800'
              }`}
            >
              Themes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('terminal')}
              className={`w-full text-left px-3 py-2 rounded-lg mb-2 ${
                activeTab === 'terminal'
                  ? 'bg-primary-600 text-white'
                  : 'text-dark-400 hover:bg-dark-800'
              }`}
            >
              Terminal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`w-full text-left px-3 py-2 rounded-lg ${
                activeTab === 'about'
                  ? 'bg-primary-600 text-white'
                  : 'text-dark-400 hover:bg-dark-800'
              }`}
            >
              About
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'themes' && (
              <div>
                <h3 className="text-lg font-medium text-white mb-4">
                  Themes ({Object.keys(themes).length})
                </h3>

                {/* Search */}
                <input
                  type="text"
                  placeholder="Search themes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-2 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />

                {searchQuery ? (
                  <div className="grid grid-cols-3 gap-3">
                    {filteredThemes.map((theme) => (
                      <ThemeButton
                        key={theme}
                        theme={theme}
                        isSelected={currentTheme === theme}
                        onSelect={() => setTheme(theme)}
                      />
                    ))}
                  </div>
                ) : (
                  Object.entries(themeCategories).map(
                    ([category, themeList]) => (
                      <div key={category} className="mb-6">
                        <h4 className="text-dark-400 text-sm font-medium mb-3 uppercase tracking-wider">
                          {category.replace(/-/g, ' ')}
                        </h4>
                        <div className="grid grid-cols-3 gap-3">
                          {themeList.map((theme) => (
                            <ThemeButton
                              key={theme}
                              theme={theme as Theme}
                              isSelected={currentTheme === theme}
                              onSelect={() => setTheme(theme as Theme)}
                            />
                          ))}
                        </div>
                      </div>
                    ),
                  )
                )}
              </div>
            )}

            {activeTab === 'terminal' && (
              <div>
                <h3 className="text-lg font-medium text-white mb-4">
                  Terminal Settings
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
                    <div>
                      <div className="text-white font-medium">Font Size</div>
                      <div className="text-dark-400 text-sm">
                        Terminal font size in pixels
                      </div>
                    </div>
                    <select className="bg-dark-700 text-white px-3 py-2 rounded-lg">
                      <option>12px</option>
                      <option>14px</option>
                      <option>16px</option>
                      <option>18px</option>
                      <option>20px</option>
                      <option>24px</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
                    <div>
                      <div className="text-white font-medium">Font Family</div>
                      <div className="text-dark-400 text-sm">
                        Terminal font family
                      </div>
                    </div>
                    <select className="bg-dark-700 text-white px-3 py-2 rounded-lg">
                      <option>JetBrains Mono</option>
                      <option>Fira Code</option>
                      <option>Source Code Pro</option>
                      <option>Cascadia Code</option>
                      <option>monospace</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
                    <div>
                      <div className="text-white font-medium">Cursor Style</div>
                      <div className="text-dark-400 text-sm">
                        Terminal cursor appearance
                      </div>
                    </div>
                    <select className="bg-dark-700 text-white px-3 py-2 rounded-lg">
                      <option>Block</option>
                      <option>Underline</option>
                      <option>Bar</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
                    <div>
                      <div className="text-white font-medium">Cursor Blink</div>
                      <div className="text-dark-400 text-sm">
                        Enable cursor blinking
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-5 h-5 rounded"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
                    <div>
                      <div className="text-white font-medium">
                        Scrollback Lines
                      </div>
                      <div className="text-dark-400 text-sm">
                        Number of lines to keep in scrollback
                      </div>
                    </div>
                    <select className="bg-dark-700 text-white px-3 py-2 rounded-lg">
                      <option>1000</option>
                      <option>5000</option>
                      <option>10000</option>
                      <option>50000</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div>
                <h3 className="text-lg font-medium text-white mb-4">
                  About TermVault
                </h3>
                <div className="bg-dark-800 rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center">
                      <span className="text-white font-bold text-2xl">TV</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white">
                        TermVault
                      </h4>
                      <p className="text-dark-400">v1.0.0</p>
                    </div>
                  </div>
                  <p className="text-dark-300 mb-4">
                    Open-source, self-hosted SSH client and infrastructure
                    management platform. A 1-to-1 replica of Termius with
                    identical encryption, but self-hosted and open-source.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-dark-400">License</span>
                      <span className="text-white">MIT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dark-400">Encryption</span>
                      <span className="text-white">
                        Libsodium (XSalsa20 + Poly1305)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dark-400">Authentication</span>
                      <span className="text-white">SRP6a + Argon2id</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-700 flex justify-end shrink-0">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}

function ThemeButton({
  theme,
  isSelected,
  onSelect,
}: { theme: Theme; isSelected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`p-3 rounded-lg border-2 text-left ${
        isSelected
          ? 'border-primary-500 bg-primary-500/10'
          : 'border-dark-700 bg-dark-800 hover:border-dark-600'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full border border-dark-600"
          style={{ backgroundColor: themes[theme].colors.background }}
        />
        <div className="min-w-0">
          <div className="text-white text-sm font-medium truncate">
            {themes[theme].name}
          </div>
          {isSelected && <div className="text-primary-400 text-xs">Active</div>}
        </div>
      </div>
    </button>
  )
}
