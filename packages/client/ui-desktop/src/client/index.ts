/**
 * Desktop integration plugin, browser half.
 *
 * Detects the Electron preload bridge (window.electronAPI) and adds:
 * 1. Desktop Bridge — forwards native menu/tray events to web GUI actions
 * 2. Command Palette — Ctrl+K fuzzy search overlay
 * 3. Status Bar — DOM-injected platform badge
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { en, zh, type DesktopKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    desktop: DesktopKey
  }
}

const NS = 'desktop'

interface WorkspacesService {
  cwd?: () => string
  getSnapshot?: () => { cwd?: string }
  startSession?: () => void
}

interface LayoutService {
  toggleSettings?: () => void
  toggleSidebar?: () => void
}

interface ElectronBridge {
  menu?: {
    onNewSession?: (cb: () => void) => unknown
    onOpenSettings?: (cb: () => void) => unknown
    onOpenWorkspace?: (cb: () => void) => unknown
  }
  window?: {
    onMaximizeChange?: (cb: (maximized: boolean) => void) => (() => void) | undefined
  }
  app?: {
    listFiles: (dir: string) => Promise<{
      success: boolean
      files: Array<{ name: string; path: string; isDir: boolean }>
      error?: string
    }>
  }
}

/** Services required by the desktop plugin. */
export const inject = ['slots', 'locale']

/** Apply the desktop integration plugin. */
export function apply(ctx: ClientContext): void {
  // Register locale dictionaries
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-desktop: dictionaries')

  // Typed translate function for this plugin's namespace
  const t = ctx.locale.bind(NS)

  // ── 1. Desktop Bridge ────────────────────────────────────────────────────
  const api = typeof window !== 'undefined' ? (window as unknown as { electronAPI?: ElectronBridge }).electronAPI : undefined
  const isElectron = api !== undefined && api !== null

  if (isElectron) {
    // Forward native menu events to web actions
    api.menu?.onNewSession?.(() => {
      const workspaces = ctx.get('workspaces' as unknown as never) as WorkspacesService | undefined
      if (workspaces?.startSession) workspaces.startSession()
    })

    api.menu?.onOpenSettings?.(() => {
      const layout = ctx.get('layout' as unknown as never) as LayoutService | undefined
      if (layout?.toggleSettings) layout.toggleSettings()
    })

    api.menu?.onOpenWorkspace?.(() => {
      const layout = ctx.get('layout' as unknown as never) as LayoutService | undefined
      if (layout?.toggleSidebar) layout.toggleSidebar()
    })

    const removeMaximizeListener = api.window?.onMaximizeChange?.((maximized: boolean) => {
      document.documentElement.classList.toggle('electron-maximized', maximized)
    })

    ctx.effect(() => () => { removeMaximizeListener?.() }, 'ui-desktop: bridge cleanup')
  }

  // ── 2. Status Bar (DOM-injected platform badge) ──────────────────────────
  if (isElectron && typeof document !== 'undefined') {
    ctx.effect(() => {
      const badge = document.createElement('div')
      badge.id = 'desktop-status-badge'
      badge.textContent = '\u{1F5A5}\uFE0F Desktop'
      badge.style.cssText = [
        'position:fixed;bottom:4px;right:8px;z-index:100;',
        'padding:2px 8px;font-size:11px;font-family:system-ui;',
        'color:var(--dsw-text-tertiary,#999);user-select:none;pointer-events:none;',
      ].join('')

      // Wait for body to be ready
      const mount = () => { document.body?.appendChild(badge) }
      if (document.body) mount()
      else document.addEventListener('DOMContentLoaded', mount, { once: true })

      return () => { badge.remove() }
    }, 'ui-desktop: status badge')
  }

  // ── 3. Command Palette (Ctrl+K / Cmd+K) ──────────────────────────────────
  ctx.effect(() => {
    if (typeof document === 'undefined') return () => {}

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        e.stopPropagation()

        const existing = document.getElementById('desktop-command-palette')
        if (existing) { existing.remove(); return }

        showCommandPalette(ctx, t as unknown as (...args: string[]) => string)
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, 'ui-desktop: keyboard shortcuts')

  // ── 4. @file Reference Source (Electron only) ─────────────────────────────
  // Registers an '@' trigger source for file path references when running
  // in Electron. Lists workspace files via IPC.
  if (isElectron) {
    const inputTriggers = ctx.get('inputTriggers' as unknown as never) as { registerSource?: (source: unknown) => void } | undefined
    const registerSource = inputTriggers?.registerSource
    if (registerSource !== undefined) {
      let cachedFiles: Array<{ name: string; path: string; isDir: boolean }> = []
      let lastDir = ''

      ctx.effect(() => {
        registerSource({
          trigger: '@',
          name: 'file',
          async candidates(_session: unknown, { query }: { query: string }) {
            // Get workspace path from workspace service
            const workspaces = ctx.get('workspaces' as unknown as never) as WorkspacesService | undefined
            const cwd = workspaces?.cwd?.() || workspaces?.getSnapshot?.()?.cwd || ''

            // Only re-fetch if directory changed
            if (cwd && cwd !== lastDir) {
              lastDir = cwd
              try {
                const result = await api.app?.listFiles(cwd)
                if (result?.success) cachedFiles = result.files
              } catch { cachedFiles = [] }
            }

            // Filter by query
            const q = query.toLowerCase()
            return cachedFiles
              .filter(f => f.name.toLowerCase().includes(q))
              .slice(0, 20)
              .map(f => ({
                name: f.isDir ? f.path + '/' : f.path,
                hint: f.isDir ? 'folder' : 'file',
              }))
          },
          onPick({ candidate }: { candidate: { name: string } }) {
            return { text: candidate.name + ' ' }
          },
          codec: {
            clipboardText: (ref: string) => ref,
            serialize: (ref: string) => Promise.resolve(ref),
          },
        } as unknown as never)
        return () => {}
      }, 'ui-desktop: @file source')
    }
  }
}

// ── Command Palette Overlay ──────────────────────────────────────────────────

interface PaletteItem {
  id: string
  title: string
  action: () => void
}

/** @param t - typed translate function bound to the 'desktop' namespace. */
function showCommandPalette(ctx: ClientContext, t: (...args: string[]) => string): void {
  const items: PaletteItem[] = [
    {
      id: 'new-session',
      title: t('palette.newSession'),
      action: () => {
        const ws = ctx.get('workspaces' as unknown as never) as WorkspacesService | undefined
        if (ws?.startSession) ws.startSession()
      },
    },
    {
      id: 'open-settings',
      title: t('palette.openSettings'),
      action: () => {
        const layout = ctx.get('layout' as unknown as never) as LayoutService | undefined
        if (layout?.toggleSettings) layout.toggleSettings()
      },
    },
    {
      id: 'toggle-sidebar',
      title: t('palette.toggleSidebar'),
      action: () => {
        const layout = ctx.get('layout' as unknown as never) as LayoutService | undefined
        if (layout?.toggleSidebar) layout.toggleSidebar()
      },
    },
  ]

  const overlay = document.createElement('div')
  overlay.id = 'desktop-command-palette'
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:99999;',
    'background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);',
    'display:flex;align-items:flex-start;justify-content:center;',
    'padding-top:20vh;font-family:system-ui,-apple-system,sans-serif;',
  ].join('')

  const panel = document.createElement('div')
  panel.style.cssText = [
    'background:var(--dsw-surface-base,#1e1e2e);color:var(--dsw-text-primary,#cdd6f4);',
    'border:1px solid var(--dsw-border-subtle,#313244);border-radius:12px;',
    'width:480px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.5);',
    'overflow:hidden;',
  ].join('')

  const input = document.createElement('input')
  input.placeholder = t('palette.placeholder')
  input.style.cssText = [
    'width:100%;padding:14px 16px;font-size:15px;',
    'background:transparent;color:inherit;border:none;outline:none;',
    'border-bottom:1px solid var(--dsw-border-subtle,#313244);',
  ].join('')

  const list = document.createElement('div')
  list.style.cssText = 'max-height:300px;overflow-y:auto;'

  function renderList(filter: string) {
    list.innerHTML = ''
    const query = filter.toLowerCase()
    const filtered = query ? items.filter(i => i.title.toLowerCase().includes(query)) : items

    if (filtered.length === 0) {
      const empty = document.createElement('div')
      empty.style.cssText = 'padding:16px;text-align:center;opacity:0.5;'
      empty.textContent = t('palette.noResults')
      list.appendChild(empty)
      return
    }

    filtered.forEach((item, idx) => {
      const row = document.createElement('div')
      row.style.cssText = [
        'padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:8px;',
        'transition:background 0.1s;',
      ].join('')
      if (idx === 0) row.style.background = 'var(--dsw-surface-hover, #313244)'

      const title = document.createElement('span')
      title.textContent = item.title
      row.appendChild(title)

      row.addEventListener('mouseenter', () => {
        list.querySelectorAll('div').forEach(d => d.style.background = '')
        row.style.background = 'var(--dsw-surface-hover, #313244)'
      })
      row.addEventListener('click', () => {
        item.action()
        overlay.remove()
      })

      list.appendChild(row)
    })
  }

  renderList('')
  input.addEventListener('input', () => renderList(input.value))

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', handleKey) }
  }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove() })
  document.addEventListener('keydown', handleKey)

  panel.appendChild(input)
  panel.appendChild(list)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)
  input.focus()
}
