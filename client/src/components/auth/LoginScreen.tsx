import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import OAuthLogin from './OAuthLogin'

export default function LoginScreen() {
  const { login, register, isLoading, error, clearError } = useAuthStore()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (isRegister) {
      if (password !== confirmPassword) {
        return
      }
      await register(email, username, password)
    } else {
      await login(email, password)
    }
  }

  const handleOAuthSuccess = (user: {
    id: string
    email: string
    username?: string
  }) => {
    console.log('OAuth success:', user)
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">TV</span>
          </div>
          <h1 className="text-3xl font-bold text-white">TermVault</h1>
          <p className="text-dark-400 mt-2">Self-hosted SSH client</p>
        </div>

        {/* Form */}
        <div className="bg-dark-900 rounded-xl p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-6">
            {isRegister ? 'Create Account' : 'Sign In'}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* OAuth Login */}
          <OAuthLogin onSuccess={handleOAuthSuccess} />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-dark-300 text-sm mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="you@example.com"
                required
              />
            </div>

            {isRegister && (
              <div>
                <label
                  htmlFor="username"
                  className="block text-dark-300 text-sm mb-2"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="johndoe"
                  required
                />
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="block text-dark-300 text-sm mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="••••••••"
                minLength={8}
                required
              />
              {isRegister && (
                <p className="text-dark-500 text-xs mt-1">
                  Minimum 8 characters
                </p>
              )}
            </div>

            {isRegister && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-dark-300 text-sm mb-2"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading
                ? 'Loading...'
                : isRegister
                  ? 'Create Account'
                  : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister)
                clearError()
              }}
              className="text-primary-500 hover:text-primary-400 text-sm"
            >
              {isRegister
                ? 'Already have an account? Sign in'
                : "Don't have an account? Create one"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
