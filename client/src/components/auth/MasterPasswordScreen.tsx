import {
  ArrowsClockwise,
  CheckCircle,
  DownloadSimple,
  Lock,
} from '@phosphor-icons/react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { useState } from 'react'
import api from '../../lib/api'
import {
  generateRecoveryKit,
  recoverFromKit,
  setupMasterPassword,
  unlockMasterPassword,
} from '../../lib/crypto'
import { migratePlaintextCredentials } from '../../lib/vaultCrypto'
import { useAuthStore } from '../../stores/authStore'

interface MasterPasswordScreenProps {
  mode: 'setup' | 'unlock' | 'recover'
  saltHex?: string
  onComplete: () => void
}

export default function MasterPasswordScreen({
  mode,
  saltHex,
  onComplete,
}: MasterPasswordScreenProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'password' | 'recovery' | 'recovery-done'>(
    mode === 'setup' ? 'password' : 'password',
  )
  const [recoveryKitJson, setRecoveryKitJson] = useState('')

  const { user, setMasterPasswordSet } = useAuthStore()

  const handleSetup = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError('')
    try {
      const key = await setupMasterPassword(password)
      await invoke('set_encryption_key', { key })
      await migratePlaintextCredentials()

      // Notify server that master password has been set
      await api.setMasterPassword()
      setMasterPasswordSet()

      const kit = await generateRecoveryKit(password)
      setRecoveryKitJson(JSON.stringify(kit, null, 2))
      setStep('recovery-done')
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to setup master password',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleUnlock = async () => {
    if (!saltHex) {
      setError('Missing salt information')
      return
    }

    setLoading(true)
    setError('')
    try {
      const key = await unlockMasterPassword(password, saltHex)
      await invoke('set_encryption_key', { key })
      await migratePlaintextCredentials()
      onComplete()
    } catch (_error: unknown) {
      setError('Invalid master password')
    } finally {
      setLoading(false)
    }
  }

  const handleRecover = async () => {
    if (!recoveryKitJson) {
      setError('Please upload your recovery kit file')
      return
    }
    if (password.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError('')
    try {
      const recoveredKey = await recoverFromKit(recoveryKitJson, password)
      await invoke('set_encryption_key', { key: recoveredKey })
      await migratePlaintextCredentials()

      const newKit = await generateRecoveryKit(password)
      setRecoveryKitJson(JSON.stringify(newKit, null, 2))

      onComplete()
    } catch (_error: unknown) {
      setError('Failed to recover from kit. Check your password.')
    } finally {
      setLoading(false)
    }
  }

  const downloadRecoveryKit = async () => {
    const path = await save({
      defaultPath: `termvault-recovery-${user?.id?.slice(0, 8) || 'kit'}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (path) {
      await invoke('write_file', { path, contents: recoveryKitJson })
    }
  }

  const handleRecoveryFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setRecoveryKitJson(event.target?.result as string)
    }
    reader.readAsText(file)
  }

  if (mode === 'unlock') {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-white" weight="bold" />
            </div>
            <h1 className="text-3xl font-bold text-white">TermVault</h1>
            <p className="text-dark-400 mt-2">
              Enter your master password to unlock
            </p>
          </div>

          <div className="bg-dark-900 rounded-xl p-6 shadow-xl">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="master-password"
                  className="block text-dark-300 text-sm mb-2"
                >
                  Master Password
                </label>
                <input
                  id="master-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter your master password"
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                />
              </div>

              <button
                type="button"
                onClick={handleUnlock}
                disabled={loading || !password}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Unlocking...' : 'Unlock'}
              </button>
            </div>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setStep('recovery')}
                className="text-dark-500 hover:text-dark-300 text-xs"
              >
                Forgot master password?
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'recover' || step === 'recovery') {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ArrowsClockwise className="w-8 h-8 text-white" weight="bold" />
            </div>
            <h1 className="text-3xl font-bold text-white">Recover Account</h1>
            <p className="text-dark-400 mt-2">
              Upload your recovery kit and set a new password
            </p>
          </div>

          <div className="bg-dark-900 rounded-xl p-6 shadow-xl">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="recovery-kit"
                  className="block text-dark-300 text-sm mb-2"
                >
                  Recovery Kit File
                </label>
                <input
                  id="recovery-kit"
                  type="file"
                  accept=".json"
                  onChange={handleRecoveryFileUpload}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="new-master-password"
                  className="block text-dark-300 text-sm mb-2"
                >
                  New Master Password
                </label>
                <input
                  id="new-master-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-dark-300 text-sm mb-2"
                >
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Confirm new password"
                />
              </div>

              <button
                type="button"
                onClick={handleRecover}
                disabled={loading || !recoveryKitJson || !password}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Recovering...' : 'Recover & Reset Password'}
              </button>
            </div>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setStep('password')}
                className="text-primary-500 hover:text-primary-400 text-sm"
              >
                Back to unlock
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'recovery-done') {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-white" weight="bold" />
            </div>
            <h1 className="text-3xl font-bold text-white">
              Save Your Recovery Kit
            </h1>
            <p className="text-dark-400 mt-2">
              Download this file and keep it safe
            </p>
          </div>

          <div className="bg-dark-900 rounded-xl p-6 shadow-xl">
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg mb-4 text-sm">
              <strong>Warning:</strong> If you lose your master password AND
              this recovery kit, your data will be permanently unrecoverable.
            </div>

            <div className="space-y-4">
              <button
                type="button"
                onClick={downloadRecoveryKit}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <DownloadSimple className="w-5 h-5" weight="bold" />
                Download Recovery Kit
              </button>

              <button
                type="button"
                onClick={onComplete}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                I've saved my recovery kit, Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-white" weight="bold" />
          </div>
          <h1 className="text-3xl font-bold text-white">Set Master Password</h1>
          <p className="text-dark-400 mt-2">
            This password encrypts all your data
          </p>
        </div>

        <div className="bg-dark-900 rounded-xl p-6 shadow-xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <div className="bg-amber-500/10 border border-amber-500/50 text-amber-500 px-4 py-3 rounded-lg mb-4 text-sm">
            <strong>Important:</strong> If you lose this password, your data
            cannot be recovered unless you have the recovery kit.
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="setup-master-password"
                className="block text-dark-300 text-sm mb-2"
              >
                Master Password
              </label>
              <input
                id="setup-master-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label
                htmlFor="setup-confirm-password"
                className="block text-dark-300 text-sm mb-2"
              >
                Confirm Password
              </label>
              <input
                id="setup-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Confirm password"
              />
            </div>

            <button
              type="button"
              onClick={handleSetup}
              disabled={loading || !password || !confirmPassword}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Set Master Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
