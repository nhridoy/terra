import { Lock } from '@phosphor-icons/react'
import { useVaultStore } from '../../stores/vaultStore'

export default function VaultList() {
  const { vaults, currentVaultId, switchVault } = useVaultStore()

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-dark-700">
        <h2 className="text-lg font-semibold text-white">Vaults</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {vaults.length === 0 ? (
          <div className="text-center text-dark-400 py-8">
            <Lock
              className="w-12 h-12 mx-auto mb-4 text-dark-600"
              weight="bold"
            />
            <p>No vaults yet</p>
            <p className="text-sm mt-2">Create a vault to store credentials</p>
          </div>
        ) : (
          vaults.map((vault) => (
            <button
              type="button"
              key={vault.id}
              onClick={() => switchVault(vault.id)}
              className={`p-3 rounded-lg cursor-pointer mb-2 text-left w-full ${
                currentVaultId === vault.id
                  ? 'bg-primary-600/20 border border-primary-500/50'
                  : 'bg-dark-800 hover:bg-dark-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-primary-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">
                    {vault.name}
                  </p>
                  {vault.description && (
                    <p className="text-sm text-dark-400 truncate">
                      {vault.description}
                    </p>
                  )}
                </div>
                {vault.isDefault && (
                  <span className="px-2 py-0.5 text-xs bg-primary-600/20 text-primary-400 rounded">
                    Default
                  </span>
                )}
                {vault.isSystem && (
                  <span className="px-2 py-0.5 text-xs bg-dark-600 text-dark-300 rounded flex items-center gap-1">
                    <Lock className="w-3 h-3" weight="bold" />
                    Protected
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
