import { useEffect } from 'react'
import LoginScreen from './components/auth/LoginScreen'
import Layout from './components/layout/Layout'
import { useAuthStore } from './stores/authStore'
import { useHostStore } from './stores/hostStore'
import { useVaultStore } from './stores/vaultStore'

function App() {
  const { isAuthenticated, isLoading } = useAuthStore()
  const { fetchHosts, fetchGroups } = useHostStore()
  const { fetchVaults, currentVaultId } = useVaultStore()

  useEffect(() => {
    if (isAuthenticated) {
      fetchHosts(currentVaultId || undefined)
      fetchGroups(currentVaultId || undefined)
      fetchVaults()
    }
  }, [isAuthenticated, currentVaultId, fetchHosts, fetchGroups, fetchVaults])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return <Layout />
}

export default App
