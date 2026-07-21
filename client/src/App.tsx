import { useEffect, useRef, useState } from 'react'
import LoginScreen from './components/auth/LoginScreen'
import MasterPasswordScreen from './components/auth/MasterPasswordScreen'
import Layout from './components/layout/Layout'
import ToastContainer from './components/ui/Toast'
import { getStoredSalt, isUnlocked, setCurrentUser } from './lib/crypto'
import { startPeriodicSync, stopPeriodicSync, syncPull } from './lib/sync'
import { useAuthStore } from './stores/authStore'
import { useHostStore } from './stores/hostStore'
import { useVaultStore } from './stores/vaultStore'

function App() {
  const { isAuthenticated, isLoading, restoreSession, hasMasterPassword } =
    useAuthStore()
  const user = useAuthStore((s) => s.user)
  const { fetchHosts, fetchGroups } = useHostStore()
  const { fetchVaults, currentVaultId } = useVaultStore()
  const [ready, setReady] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const didRestore = useRef(false)

  const storedSalt = user?.id ? getStoredSalt(user.id) : null

  // Set current user for per-user salt storage
  useEffect(() => {
    setCurrentUser(user?.id ?? null)
  }, [user?.id])

  // Restore session once on mount
  useEffect(() => {
    if (didRestore.current) return
    didRestore.current = true
    restoreSession().finally(() => setReady(true))
  }, [restoreSession])

  // If master key is in memory, mark as unlocked
  useEffect(() => {
    if (isUnlocked()) {
      setUnlocked(true)
    }
  })

  // Start sync when ready
  useEffect(() => {
    if (isAuthenticated && unlocked) {
      syncPull().then(() => {
        fetchHosts(currentVaultId || undefined)
        fetchGroups(currentVaultId || undefined)
        fetchVaults()
      })
      startPeriodicSync()
    }
    return () => stopPeriodicSync()
  }, [
    isAuthenticated,
    unlocked,
    currentVaultId,
    fetchHosts,
    fetchGroups,
    fetchVaults,
  ])

  // Loading: waiting for restoreSession or login in progress
  if (!ready || isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  // Not authenticated: show login
  if (!isAuthenticated) {
    return <LoginScreen />
  }

  // Authenticated but no master password: show setup
  if (!hasMasterPassword) {
    return (
      <MasterPasswordScreen
        mode="setup"
        onComplete={() => {
          setUnlocked(true)
          syncPull().then(() => {
            fetchHosts(currentVaultId || undefined)
            fetchGroups(currentVaultId || undefined)
            fetchVaults()
          })
          startPeriodicSync()
        }}
      />
    )
  }

  // Authenticated, has master password, but not unlocked: show unlock
  if (!unlocked) {
    return (
      <MasterPasswordScreen
        mode="unlock"
        saltHex={storedSalt || undefined}
        onComplete={() => setUnlocked(true)}
      />
    )
  }

  // Everything ready: show main app
  return (
    <>
      <Layout />
      <ToastContainer />
    </>
  )
}

export default App
