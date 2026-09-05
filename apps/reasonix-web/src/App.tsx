import { useEffect } from 'react'
import { AppChrome } from './components/AppChrome'
import { Sidebar } from './components/Sidebar'
import { Inspector } from './components/Inspector'
import { Transcript } from './components/Transcript'
import { Composer } from './components/Composer'
import { StatusBar } from './components/StatusBar'
import { Welcome } from './components/Welcome'
import { SidePanel } from './components/SidePanel'
import { useStore } from './lib/store'

/**
 * Reasonix-style root. Wires the standalone UI components to the zustand
 * store, which fronts either the live DeepSeek-Harness backend (HarnessApi)
 * or the offline MockApi. Initializes on mount and lets the chrome/sidebar/
 * composer act on the same state.
 */
export function App() {
  const sessions = useStore(s => s.sessions)
  const activeSessionId = useStore(s => s.activeSessionId)
  const runningSessions = useStore(s => s.runningSessions)
  const messages = useStore(s => s.messages)
  const connected = useStore(s => s.connected)
  const useLiveBackend = useStore(s => s.useLiveBackend)
  const mode = useStore(s => s.mode)
  const sidebarCollapsed = useStore(s => s.sidebarCollapsed)
  const inspectorOpen = useStore(s => s.inspectorOpen)
  const init = useStore(s => s.init)
  const selectSession = useStore(s => s.selectSession)
  const newSession = useStore(s => s.newSession)
  const submitPrompt = useStore(s => s.submitPrompt)
  const setMode = useStore(s => s.setMode)
  const toggleSidebar = useStore(s => s.toggleSidebar)
  const toggleInspector = useStore(s => s.toggleInspector)
  const openCommandPalette = useStore(s => s.openCommandPalette)
  const openSettings = useStore(s => s.openSettings)
  const openSidePanel = useStore(s => s.openSidePanel)

  useEffect(() => {
    void init()
  }, [init])

  return (
    <div className="app" data-theme={useStore(s => s.theme)}>
      <AppChrome
        sidebarCollapsed={sidebarCollapsed}
        inspectorOpen={inspectorOpen}
        onToggleSidebar={toggleSidebar}
        onToggleInspector={toggleInspector}
        onNewTab={() => void newSession()}
        onOpenPalette={() => openCommandPalette(true)}
        onOpenSettings={() => openSettings(true)}
      />
      <div className="app__body">
        <Sidebar
          collapsed={sidebarCollapsed}
          sessions={sessions}
          activeId={activeSessionId}
          runningSessions={runningSessions}
          onSelect={id => void selectSession(id)}
          onNew={() => void newSession()}
          onNewInProject={cwd => void newSession(cwd)}
          onOpenSettings={() => openSettings(true)}
          onOpenPanel={k => openSidePanel(k)}
        />
        <main className="app__content">
          {messages.length === 0 ? (
            <Welcome onPrompt={t => void submitPrompt(t)} />
          ) : (
            <Transcript messages={messages} />
          )}
          {activeSessionId === null && (
            <div className="backend-note">
              {useLiveBackend
                ? connected
                  ? '已连接本地 DeepSeek-Harness 后端'
                  : '后端未连接，回退到演示数据'
                : '离线演示模式'}
              <BackendToggle />
            </div>
          )}
          <Composer
            mode={mode}
            onMode={setMode}
            onSubmit={(t, a) => submitPrompt(t, a)}
          />
        </main>
        <Inspector />
        <SidePanel />
      </div>
      <StatusBar />
    </div>
  )
}

// Re-exported so a conditional live-backend toggle stays reachable from the UI
// without coupling App to a specific settings surface.
export function useBackendFlag(): [boolean, (v: boolean) => void] {
  return [useStore(s => s.useLiveBackend), useStore(s => s.setUseLiveBackend)]
}

/** Inline live-backend switch for the standalone shell (Mock <-> harness). */
function BackendToggle() {
  const [live, setLive] = useBackendFlag()
  return (
    <button className="backend-toggle" onClick={() => setLive(!live)} title="切换实时后端 / 离线演示">
      {live ? '实时后端' : '启用实时后端'}
    </button>
  )
}
