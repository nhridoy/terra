import { useCallback, useState } from 'react'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useTerminalStore } from '../../stores/terminalStore'
import ConnectionStatus from '../connection/ConnectionStatus'
import CommandAutocomplete from './CommandAutocomplete'
import FocusMode from './FocusMode'
import HostBrowser from './HostBrowser'
import QuickConnect from './QuickConnect'
import Terminal from './Terminal'

interface TerminalViewProps {
  onSetActiveView?: (view: string) => void
}

export default function TerminalView({ onSetActiveView }: TerminalViewProps) {
  const { tabs, activeTabId, connectTab } =
    useTerminalStore()
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(true)

  const activeTab = tabs.find((tab) => tab.id === activeTabId)
  const connectionStatus = activeTab?.connectionStatus ?? 'disconnected'

  const handleNextTab = useCallback(() => {
    const currentIndex = tabs.findIndex((t) => t.id === activeTabId)
    if (currentIndex < tabs.length - 1) {
      const nextTab = tabs[currentIndex + 1]
      useTerminalStore.getState().setActiveTab(nextTab.id)
      onSetActiveView?.(nextTab.id)
    } else if (tabs.length > 0) {
      const firstTab = tabs[0]
      useTerminalStore.getState().setActiveTab(firstTab.id)
      onSetActiveView?.(firstTab.id)
    }
  }, [tabs, activeTabId, onSetActiveView])

  const handlePrevTab = useCallback(() => {
    const currentIndex = tabs.findIndex((t) => t.id === activeTabId)
    if (currentIndex > 0) {
      const prevTab = tabs[currentIndex - 1]
      useTerminalStore.getState().setActiveTab(prevTab.id)
      onSetActiveView?.(prevTab.id)
    } else if (tabs.length > 0) {
      const lastTab = tabs[tabs.length - 1]
      useTerminalStore.getState().setActiveTab(lastTab.id)
      onSetActiveView?.(lastTab.id)
    }
  }, [tabs, activeTabId, onSetActiveView])

  const handleFocusMode = useCallback(() => {
    setIsFocusMode(!isFocusMode)
  }, [isFocusMode])

  const handleToggleSidebar = useCallback(() => {
    setSidebarVisible(!sidebarVisible)
    window.dispatchEvent(
      new CustomEvent('toggle-sidebar', {
        detail: { visible: !sidebarVisible },
      }),
    )
  }, [sidebarVisible])

  const handleCommandSelect = useCallback((command: string) => {
    console.log('Execute command:', command)
    setShowCommandPalette(false)
  }, [])

  const handleQuickConnectHost = useCallback(
    (host: any) => {
      const newTabId = useTerminalStore.getState().addEmptyTab()
      connectTab(newTabId, host.id, host.name, {
        hostAddress: host.address,
        hostPort: host.port,
        hostUsername: host.username,
      })
      onSetActiveView?.(newTabId)
    },
    [connectTab, onSetActiveView],
  )

  // Create a stable onConnect handler for each tab's HostBrowser
  const makeTabConnectHandler = useCallback(
    (tabId: string) => {
      return (host: any) => {
        const tab = useTerminalStore.getState().tabs.find((t) => t.id === tabId)
        if (tab && !tab.hostId) {
          connectTab(tabId, host.id, host.name, {
            hostAddress: host.address,
            hostPort: host.port,
            hostUsername: host.username,
          })
        }
      }
    },
    [connectTab],
  )

  useKeyboardShortcuts({
    onNewTab: () => {
      const newTabId = useTerminalStore.getState().addEmptyTab()
      onSetActiveView?.(newTabId)
    },
    onCloseTab: () => {},
    onNextTab: handleNextTab,
    onPrevTab: handlePrevTab,
    onSplitHorizontal: () => {},
    onSplitVertical: () => {},
    onFocusMode: handleFocusMode,
    onQuickConnect: () => {},
    onCommandPalette: () => setShowCommandPalette(!showCommandPalette),
    onSaveWorkspace: () => console.log('Save workspace'),
    onToggleSidebar: handleToggleSidebar,
  })

  if (!activeTab) return null

  return (
    <FocusMode isActive={isFocusMode} onExit={() => setIsFocusMode(false)}>
      <div className="flex flex-col flex-1 min-h-0">
        {/* Connection Status Bar */}
        {activeTab.hostId && (
          <div className="px-4 py-2 border-b bg-dark-800 border-dark-700">
            <ConnectionStatus
              status={connectionStatus}
              hostName={activeTab.title}
            />
          </div>
        )}

        {/* Terminal Content — render ALL tabs, hide inactive ones */}
        <div className="relative flex-1 min-h-0 overflow-hidden bg-dark-950">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 ${tab.id === activeTabId ? '' : 'opacity-0 pointer-events-none'}`}
            >
              {tab.hostId ? (
                <Terminal
                  hostId={tab.hostId}
                  hostName={tab.title}
                  tabId={tab.id}
                  hostAddress={tab.hostAddress}
                  hostPort={tab.hostPort}
                  hostUsername={tab.hostUsername}
                  isActive={tab.id === activeTabId}
                />
              ) : (
                <HostBrowser onConnect={makeTabConnectHandler(tab.id)} />
              )}
            </div>
          ))}
        </div>

        <QuickConnect onConnect={handleQuickConnectHost} />

        <CommandAutocomplete
          isVisible={showCommandPalette}
          onSelect={handleCommandSelect}
          onClose={() => setShowCommandPalette(false)}
        />
      </div>
    </FocusMode>
  )
}
