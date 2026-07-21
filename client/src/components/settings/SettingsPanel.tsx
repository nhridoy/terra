import { invoke } from '@tauri-apps/api/core'
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useTerminalStore } from '../../stores/terminalStore'
import { type Theme, themes, useThemeStore } from '../../stores/themeStore'
import settingsTabs from './SettingsTabs'

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { user, updateProfile, changePassword } = useAuthStore()
  const { currentTheme, setTheme } = useThemeStore()
  const { tabs, closeAllTabs } = useTerminalStore()

  const [activeTab, setActiveTab] = useState<
    'appearance' | 'terminal' | 'ssh' | 'security' | 'advanced'
  >('appearance')
  const [fontSize, setFontSize] = useState(14)
  const [fontFamily, setFontFamily] = useState('JetBrains Mono')
  const [cursorStyle, setCursorStyle] = useState('block')
  const [cursorBlink, setCursorBlink] = useState(true)
  const [scrollback, setScrollback] = useState(10000)
  const [bellStyle, setBellStyle] = useState('none')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Profile state
  const [profileName, setProfileName] = useState(user?.username || '')
  const [profileEmail, setProfileEmail] = useState(user?.email || '')

  // Known hosts state
  interface KnownHost {
    host: string
    port: number
    fingerprint: string
  }
  const [knownHosts, setKnownHosts] = useState<KnownHost[]>([])
  const [knownHostsLoading, setKnownHostsLoading] = useState(false)

  const loadKnownHosts = useCallback(async () => {
    try {
      setKnownHostsLoading(true)
      const hosts = await invoke<KnownHost[]>('list_known_hosts')
      setKnownHosts(hosts)
    } catch (err) {
      console.error('Failed to load known hosts:', err)
    } finally {
      setKnownHostsLoading(false)
    }
  }, [])

  const handleRemoveKnownHost = async (host: string, port: number) => {
    if (
      await tauriConfirm(
        `Remove known host for ${host}:${port}? You will be prompted to verify their identity on next connection.`,
        { title: 'Remove Known Host', kind: 'warning' },
      )
    ) {
      try {
        await invoke('remove_known_host', { host, port })
        setKnownHosts((prev) =>
          prev.filter((h) => !(h.host === host && h.port === port)),
        )
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to remove known host',
        )
      }
    }
  }

  const handleClearAllKnownHosts = async () => {
    if (
      await tauriConfirm(
        'Clear ALL known hosts? You will be prompted to verify identity for every host on next connection.',
        { title: 'Clear All Known Hosts', kind: 'warning' },
      )
    ) {
      try {
        await invoke('clear_known_hosts')
        setKnownHosts([])
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to clear known hosts',
        )
      }
    }
  }

  useEffect(() => {
    // Load settings from localStorage
    const savedFontSize = localStorage.getItem('termvault.fontSize')
    const savedFontFamily = localStorage.getItem('termvault.fontFamily')
    const savedCursorStyle = localStorage.getItem('termvault.cursorStyle')
    const savedCursorBlink = localStorage.getItem('termvault.cursorBlink')
    const savedScrollback = localStorage.getItem('termvault.scrollback')
    const savedBellStyle = localStorage.getItem('termvault.bellStyle')

    if (savedFontSize) setFontSize(parseInt(savedFontSize, 10))
    if (savedFontFamily) setFontFamily(savedFontFamily)
    if (savedCursorStyle)
      setCursorStyle(savedCursorStyle as 'block' | 'underline' | 'bar')
    if (savedCursorBlink) setCursorBlink(savedCursorBlink === 'true')
    if (savedScrollback) setScrollback(parseInt(savedScrollback, 10))
    if (savedBellStyle)
      setBellStyle(savedBellStyle as 'none' | 'sound' | 'visual')
  }, [])

  useEffect(() => {
    if (activeTab === 'ssh') {
      loadKnownHosts()
    }
  }, [activeTab, loadKnownHosts])

  const saveSetting = (key: string, value: string) => {
    localStorage.setItem(`termvault.${key}`, value)
  }

  const handleFontSizeChange = (value: number) => {
    setFontSize(value)
    saveSetting('fontSize', value.toString())
  }

  const handleFontFamilyChange = (value: string) => {
    setFontFamily(value)
    saveSetting('fontFamily', value)
  }

  const handleCursorStyleChange = (value: 'block' | 'underline' | 'bar') => {
    setCursorStyle(value)
    saveSetting('cursorStyle', value)
  }

  const handleCursorBlinkChange = (value: boolean) => {
    setCursorBlink(value)
    saveSetting('cursorBlink', value.toString())
  }

  const handleScrollbackChange = (value: number) => {
    setScrollback(value)
    saveSetting('scrollback', value.toString())
  }

  const handleBellStyleChange = (value: 'none' | 'sound' | 'visual') => {
    setBellStyle(value)
    saveSetting('bellStyle', value)
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await updateProfile({ username: profileName, email: profileEmail })
      setSuccess('Profile updated successfully')
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : String(err) || 'Failed to update profile',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await changePassword(currentPassword, newPassword)
      setSuccess('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : String(err) || 'Failed to change password',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearAllSessions = async () => {
    if (
      await tauriConfirm(
        'Are you sure you want to close all active terminal sessions?',
        { title: 'Close Sessions', kind: 'warning' },
      )
    ) {
      closeAllTabs()
    }
  }

  const handleExportSettings = () => {
    const settings = {
      theme: currentTheme,
      fontSize,
      fontFamily,
      cursorStyle,
      cursorBlink,
      scrollback,
      bellStyle,
    }
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'termvault-settings.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const settings = JSON.parse(event.target?.result as string)
        if (settings.theme) setTheme(settings.theme)
        if (settings.fontSize) handleFontSizeChange(settings.fontSize)
        if (settings.fontFamily) handleFontFamilyChange(settings.fontFamily)
        if (settings.cursorStyle) handleCursorStyleChange(settings.cursorStyle)
        if (settings.cursorBlink !== undefined)
          handleCursorBlinkChange(settings.cursorBlink)
        if (settings.scrollback) handleScrollbackChange(settings.scrollback)
        if (settings.bellStyle) handleBellStyleChange(settings.bellStyle)
        setSuccess('Settings imported successfully')
      } catch {
        setError('Invalid settings file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full">
      {/* Settings Navigation */}
      <div className="flex border-b border-dark-700 px-4">
        {settingsTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'text-primary-500 bg-dark-800 border-b-2 border-primary-500'
                : 'text-dark-400 hover:text-white hover:bg-dark-800/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-500/20 border border-green-500/50 text-green-400 rounded-lg">
            {success}
          </div>
        )}

        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
          <div className="space-y-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-white">Theme</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(themes).map(([id, theme]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme(id as Theme)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    currentTheme === id
                      ? 'border-primary-500 ring-2 ring-primary-500/20'
                      : 'border-dark-700 hover:border-dark-600'
                  }`}
                >
                  <div
                    className="w-full h-12 rounded mb-2"
                    style={{ background: theme.colors.background }}
                  />
                  <div className="text-sm font-medium text-white capitalize">
                    {theme.name}
                  </div>
                  <div className="text-xs text-dark-400 mt-1">{id}</div>
                </button>
              ))}
            </div>

            <div className="border-t border-dark-700 pt-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Editor Font
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="font-family"
                    className="block text-dark-300 text-sm mb-2"
                  >
                    Font Family
                  </label>
                  <select
                    id="font-family"
                    value={fontFamily}
                    onChange={(e) => handleFontFamilyChange(e.target.value)}
                    className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="JetBrains Mono">JetBrains Mono</option>
                    <option value="Fira Code">Fira Code</option>
                    <option value="Source Code Pro">Source Code Pro</option>
                    <option value="Monospace">Monospace</option>
                    <option value="Cascadia Code">Cascadia Code</option>
                    <option value="Iosevka">Iosevka</option>
                    <option value="Victor Mono">Victor Mono</option>
                    <option value="Ubuntu Mono">Ubuntu Mono</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="font-size"
                    className="block text-dark-300 text-sm mb-2"
                  >
                    Font Size: {fontSize}px
                  </label>
                  <input
                    id="font-size"
                    type="range"
                    min="10"
                    max="24"
                    value={fontSize}
                    onChange={(e) =>
                      handleFontSizeChange(parseInt(e.target.value, 10))
                    }
                    className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Terminal Tab */}
        {activeTab === 'terminal' && (
          <div className="space-y-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-white">Cursor</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="cursor-style"
                  className="block text-dark-300 text-sm mb-2"
                >
                  Cursor Style
                </label>
                <select
                  id="cursor-style"
                  value={cursorStyle}
                  onChange={(e) =>
                    handleCursorStyleChange(
                      e.target.value as 'block' | 'underline' | 'bar',
                    )
                  }
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="block">Block</option>
                  <option value="underline">Underline</option>
                  <option value="bar">Bar</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  id="cursor-blink"
                  checked={cursorBlink}
                  onChange={(e) => handleCursorBlinkChange(e.target.checked)}
                  className="w-4 h-4 accent-primary-500"
                />
                <label
                  htmlFor="cursor-blink"
                  className="text-white cursor-pointer"
                >
                  Cursor Blink
                </label>
              </div>
            </div>

            <div className="border-t border-dark-700 pt-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Scrollback
              </h3>
              <div>
                <label
                  htmlFor="scrollback"
                  className="block text-dark-300 text-sm mb-2"
                >
                  Scrollback Lines: {scrollback.toLocaleString()}
                </label>
                <input
                  id="scrollback"
                  type="range"
                  min="1000"
                  max="100000"
                  step="1000"
                  value={scrollback}
                  onChange={(e) =>
                    handleScrollbackChange(parseInt(e.target.value, 10))
                  }
                  className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
              </div>
            </div>

            <div className="border-t border-dark-700 pt-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Bell Style
              </h3>
              <select
                value={bellStyle}
                onChange={(e) =>
                  handleBellStyleChange(
                    e.target.value as 'none' | 'sound' | 'visual',
                  )
                }
                className="w-full max-w-xs bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="none">None</option>
                <option value="sound">Sound</option>
                <option value="visual">Visual Flash</option>
              </select>
            </div>
          </div>
        )}

        {/* SSH Tab */}
        {activeTab === 'ssh' && (
          <div className="space-y-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-white">
              SSH Configuration
            </h3>
            <div className="bg-dark-800 rounded-lg p-4 space-y-4">
              <h4 className="text-white font-medium">SSH Client Settings</h4>
              <div className="space-y-3 text-sm text-dark-300">
                <p>
                  SSH client options are configured per-host in the host
                  settings.
                </p>
                <p className="text-dark-500">
                  Global SSH options will be available in a future update.
                </p>
              </div>
            </div>

            <div className="border-t border-dark-700 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-medium">Known Hosts</h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={loadKnownHosts}
                    disabled={knownHostsLoading}
                    className="text-sm text-dark-400 hover:text-white"
                  >
                    {knownHostsLoading ? 'Loading...' : 'Refresh'}
                  </button>
                  {knownHosts.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllKnownHosts}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {knownHosts.length === 0 ? (
                <div className="bg-dark-800 rounded-lg p-4 text-sm text-dark-400">
                  {knownHostsLoading
                    ? 'Loading known hosts...'
                    : 'No known hosts. They are saved automatically when you verify a host on first connection.'}
                </div>
              ) : (
                <div className="bg-dark-800 rounded-lg divide-y divide-dark-700">
                  {knownHosts.map((kh) => (
                    <div
                      key={`${kh.host}:${kh.port}`}
                      className="flex items-center justify-between p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-white text-sm font-mono truncate">
                          {kh.host}:{kh.port}
                        </p>
                        <p className="text-dark-500 text-xs font-mono truncate mt-0.5">
                          {kh.fingerprint}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveKnownHost(kh.host, kh.port)}
                        className="text-dark-400 hover:text-red-400 text-xs ml-3 shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-dark-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Change Password
              </h3>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label
                    htmlFor="current-password"
                    className="block text-dark-300 text-sm mb-2"
                  >
                    Current Password
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-dark-300 text-sm mb-2"
                  >
                    New Password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    minLength={8}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-dark-300 text-sm mb-2"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    minLength={8}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isLoading ? 'Changing...' : 'Change Password'}
                </button>
              </form>
            </div>

            <div className="bg-dark-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Profile</h3>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label
                    htmlFor="profile-name"
                    className="block text-dark-300 text-sm mb-2"
                  >
                    Username
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="profile-email"
                    className="block text-dark-300 text-sm mb-2"
                  >
                    Email
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save Profile'}
                </button>
              </form>
            </div>

            <div className="bg-dark-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Sessions
              </h3>
              <button
                type="button"
                onClick={handleClearAllSessions}
                className="w-full px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
              >
                Close All Sessions ({tabs.length})
              </button>
            </div>
          </div>
        )}

        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-dark-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Import / Export Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={handleExportSettings}
                  className="px-4 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors text-left"
                >
                  <p className="font-medium">Export Settings</p>
                  <p className="text-sm text-dark-400">
                    Download current settings as JSON
                  </p>
                </button>
                <div>
                  <label
                    htmlFor="import-settings"
                    className="block text-dark-300 text-sm mb-2"
                  >
                    Import Settings
                  </label>
                  <input
                    id="import-settings"
                    type="file"
                    accept=".json"
                    onChange={handleImportSettings}
                    className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="bg-dark-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Danger Zone
              </h3>
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      await tauriConfirm(
                        'Are you sure you want to delete all data? This cannot be undone.',
                        { title: 'Delete All Data', kind: 'warning' },
                      )
                    ) {
                      // TODO: Implement data deletion
                    }
                  }}
                  className="w-full px-4 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors text-left"
                >
                  <p className="font-medium">Delete All Data</p>
                  <p className="text-sm text-red-500">
                    Permanently delete all hosts, keys, snippets, and settings
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Common footer */}
      <div className="pt-6 border-t border-dark-700 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-dark-400 hover:text-white"
        >
          Done
        </button>
      </div>
    </div>
  )
}
