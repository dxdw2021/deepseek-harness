/**
 * DSH Desktop — File Browser Panel
 *
 * Adds a floating "📁 Files" button in the top-right corner of the app.
 * Clicking it opens a slide-in file browser panel from the right edge.
 * Works regardless of the React SPA's DOM structure.
 */
(function () {
  'use strict'
  if (window.__DSH_SIDEBAR_INJECTED__) return
  window.__DSH_SIDEBAR_INJECTED__ = true

  var workspacePath = ''
  var files = []
  var isOpen = false

  function api() { return window.electronAPI && window.electronAPI.sidebar }

  /* ── Inject CSS ───────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('dsh-fb-css')) return
    var s = document.createElement('style')
    s.id = 'dsh-fb-css'
    s.textContent =
      /* Toggle button */
      '#dsh-fb-toggle{position:fixed;top:8px;right:12px;z-index:99998;' +
      'display:inline-flex;align-items:center;gap:4px;' +
      'padding:5px 12px;border-radius:20px;border:1px solid rgba(255,255,255,.12);' +
      'background:rgba(30,30,50,.85);backdrop-filter:blur(8px);' +
      'color:#b0b0cc;font-size:12px;font-weight:500;font-family:system-ui,sans-serif;' +
      'cursor:pointer;transition:all .15s;box-shadow:0 2px 8px rgba(0,0,0,.25)}' +
      '#dsh-fb-toggle:hover{background:rgba(40,40,65,.95);color:#e5e5e5;border-color:rgba(99,102,241,.4)}' +
      '#dsh-fb-toggle.active{background:rgba(99,102,241,.25);color:#c8c8ff;border-color:rgba(99,102,241,.5)}' +

      /* Panel */
      '#dsh-fb-panel{position:fixed;top:0;right:0;width:360px;height:100vh;z-index:99997;' +
      'background:#16162a;border-left:1px solid #2a2a42;' +
      'display:none;flex-direction:column;' +
      'font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#d4d4e3;' +
      'box-shadow:-4px 0 32px rgba(0,0,0,.5);transition:transform .2s ease}' +
      '#dsh-fb-panel.open{display:flex}' +

      /* Panel header */
      '.fb-hdr{display:flex;align-items:center;gap:8px;padding:10px 14px;' +
      'border-bottom:1px solid #2a2a42;background:#1a1a30;flex-shrink:0}' +
      '.fb-hdr-title{flex:1;font-weight:600;font-size:13px;color:#c8c8dd}' +
      '.fb-x{width:24px;height:24px;border:none;border-radius:4px;background:transparent;' +
      'color:#8888a8;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center}' +
      '.fb-x:hover{background:#2a2a42;color:#e5e5e5}' +

      /* Toolbar */
      '.fb-bar{display:flex;align-items:center;gap:6px;padding:8px 12px;' +
      'border-bottom:1px solid #2a2a42;flex-shrink:0}' +
      '.fb-input{flex:1;padding:5px 8px;border-radius:4px;background:#22223a;' +
      'border:1px solid #333352;color:#d4d4e3;font-size:12px;outline:none}' +
      '.fb-input:focus{border-color:#6366f1}' +
      '.fb-input::placeholder{color:#555570}' +

      /* List */
      '.fb-list{flex:1;overflow-y:auto;padding:4px 0}' +
      '.fb-msg{padding:32px 16px;text-align:center;color:#666680}' +
      '.fb-msg.err{color:#ef4444}' +
      '.fb-row{display:flex;align-items:center;gap:8px;padding:5px 12px;' +
      'cursor:pointer;white-space:nowrap;overflow:hidden;' +
      'border-left:3px solid transparent;transition:background .08s}' +
      '.fb-row:hover{background:#1e1e34;border-left-color:#6366f1}' +
      '.fb-row.sel{background:#26264a;border-left-color:#6366f1}' +
      '.fb-row-icon{width:16px;text-align:center;flex-shrink:0;font-size:13px}' +
      '.fb-row-name{flex:1;overflow:hidden;text-overflow:ellipsis;font-size:12px}' +
      '.fb-row-size{color:#666680;font-size:11px;flex-shrink:0}' +

      /* Preview */
      '.fb-preview{border-top:1px solid #2a2a42;max-height:50%;display:none;' +
      'flex-direction:column;flex-shrink:0;background:#141428}' +
      '.fb-preview.vis{display:flex}' +
      '.fb-pv-hdr{display:flex;align-items:center;gap:6px;padding:7px 12px;' +
      'border-bottom:1px solid #2a2a42;font-size:11px}' +
      '.fb-pv-path{flex:1;overflow:hidden;text-overflow:ellipsis;color:#9999bb}' +
      '.fb-pv-body{flex:1;overflow:auto;padding:10px 14px;margin:0;' +
      'font-family:SF Mono,Monaco,Consolas,monospace;font-size:12px;' +
      'line-height:1.65;white-space:pre-wrap;word-break:break-all;color:#bbb}' +

      '.fb-list::-webkit-scrollbar{width:5px}' +
      '.fb-list::-webkit-scrollbar-track{background:transparent}' +
      '.fb-list::-webkit-scrollbar-thumb{background:#3a3a55;border-radius:3px}' +
      '.fb-pv-body::-webkit-scrollbar{width:5px}' +
      '.fb-pv-body::-webkit-scrollbar-thumb{background:#3a3a55;border-radius:3px}'
    document.head.appendChild(s)
  }

  /* ── Build DOM ────────────────────────────────────────── */
  function buildDOM() {
    if (document.getElementById('dsh-fb-toggle')) return

    // Toggle button
    var tog = document.createElement('button')
    tog.id = 'dsh-fb-toggle'
    tog.innerHTML = '\uD83D\uDCC1 Files'
    tog.title = 'Browse workspace files'
    tog.onclick = toggle
    document.body.appendChild(tog)

    // Panel
    var p = document.createElement('div')
    p.id = 'dsh-fb-panel'
    p.innerHTML =
      '<div class="fb-hdr">' +
        '<span class="fb-hdr-title">Workspace Files</span>' +
        '<button class="fb-x" id="fb-pick" title="Select workspace folder">\uD83D\uDCC2</button>' +
        '<button class="fb-x" id="fb-close" title="Close">\u2715</button>' +
      '</div>' +
      '<div class="fb-bar">' +
        '<input class="fb-input" id="fb-search" placeholder="Filter files\u2026">' +
        '<button class="fb-x" id="fb-refresh" title="Refresh">\u21BB</button>' +
      '</div>' +
      '<div class="fb-list" id="fb-list"><div class="fb-msg">Click Files to browse</div></div>' +
      '<div class="fb-preview" id="fb-preview">' +
        '<div class="fb-pv-hdr">' +
          '<span class="fb-pv-path" id="fb-ppath"></span>' +
          '<button class="fb-x" id="fb-pclose">\u2715</button>' +
        '</div>' +
        '<pre class="fb-pv-body" id="fb-pbody"></pre>' +
      '</div>'
    document.body.appendChild(p)

    // Events
    p.querySelector('#fb-close').onclick = toggle
    p.querySelector('#fb-search').oninput = function (e) {
      var q = e.target.value.toLowerCase()
      p.querySelectorAll('.fb-row').forEach(function (r) {
        r.style.display = (r.dataset.p || '').toLowerCase().indexOf(q) !== -1 ? '' : 'none'
      })
    }
    p.querySelector('#fb-refresh').onclick = load
    p.querySelector('#fb-pclose').onclick = function () {
      p.querySelector('#fb-preview').classList.remove('vis')
      p.querySelectorAll('.fb-row.sel').forEach(function (r) { r.classList.remove('sel') })
    }
    p.querySelector('#fb-pick').onclick = function () {
      console.log('[DSH Sidebar] pick button clicked')
      var a = api()
      console.log('[DSH Sidebar] api:', a ? Object.keys(a) : 'null')
      if (!a || !a.pickFolder) { console.log('[DSH Sidebar] pickFolder not available'); return }
      a.pickFolder().then(function (r) {
        console.log('[DSH Sidebar] pickFolder result:', JSON.stringify(r))
        if (r && r.success && r.path) {
          workspacePath = r.path
          localStorage.setItem('dsh-sidebar-workspace', r.path)
          updateTitle(r.path)
          loadFiles(r.path)
        }
      }).catch(function (e) { console.error('[DSH Sidebar] pickFolder error:', e) })
    }
  }

  function updateTitle(ws) {
    var p = document.getElementById('dsh-fb-panel')
    if (!p) return
    var titleEl = p.querySelector('.fb-hdr-title')
    if (titleEl && ws) {
      var shortPath = ws.split(/[/\\]/).slice(-2).join('/')
      titleEl.textContent = '\uD83D\uDCC1 ' + shortPath
    }
  }

  /* ── Toggle ───────────────────────────────────────────── */
  function toggle() {
    isOpen = !isOpen
    var p = document.getElementById('dsh-fb-panel')
    var t = document.getElementById('dsh-fb-toggle')
    if (p) p.classList.toggle('open', isOpen)
    if (t) t.classList.toggle('active', isOpen)
    if (isOpen) {
      // Refresh workspace detection from title each time
      workspacePath = detectWorkspaceFromTitle() || workspacePath
      var titleEl = p.querySelector('.fb-hdr-title')
      if (titleEl && workspacePath) {
        var shortPath = workspacePath.split(/[/\\]/).slice(-2).join('/')
        titleEl.textContent = '📁 ' + shortPath
      }
      if (files.length === 0) load()
    }
  }

  /* ── Load ─────────────────────────────────────────────── */
  function load() {
    var list = document.getElementById('fb-list')
    if (!list) return
    if (!api()) { list.innerHTML = '<div class="fb-msg err">IPC not available</div>'; return }
    list.innerHTML = '<div class="fb-msg">Loading\u2026</div>'

    // Priority: localStorage > title detection > API call
    var savedWs = localStorage.getItem('dsh-sidebar-workspace')

    // Try page title first (fast, direct)
    var titlePath = detectWorkspaceFromTitle()
    if (titlePath) {
      workspacePath = titlePath
      console.log('[DSH Sidebar] Workspace from title: ' + workspacePath)
      updateTitle(workspacePath)
      loadFiles(workspacePath)
      return
    }

    // Try saved workspace from localStorage
    if (savedWs) {
      workspacePath = savedWs
      console.log('[DSH Sidebar] Workspace from localStorage: ' + workspacePath)
      updateTitle(workspacePath)
      loadFiles(workspacePath)
      return
    }

    // Try active session cwd (reliable but async)
    if (api().getActiveSessionCwd) {
      api().getActiveSessionCwd().then(function (r) {
        console.log('[DSH Sidebar] getActiveSessionCwd:', JSON.stringify(r))
        if (r && r.success && r.cwd) {
          workspacePath = r.cwd
          localStorage.setItem('dsh-sidebar-workspace', r.cwd)
        }
        updateTitle(workspacePath)
        loadFiles(workspacePath || '')
      }).catch(function (e) {
        console.error('[DSH Sidebar] getActiveSessionCwd error:', e)
        updateTitle(workspacePath)
        loadFiles(workspacePath || '')
      })
    } else {
      updateTitle(workspacePath)
      loadFiles(workspacePath || '')
    }
  }

  function loadFiles(ws) {
    var list = document.getElementById('fb-list')
    console.log('[DSH Sidebar] loadFiles called with ws="' + ws + '"')
    return api().listProducedFiles(ws).then(function (r) {
      console.log('[DSH Sidebar] listProducedFiles result:', JSON.stringify(r).substring(0, 500))
      files = (r && r.success) ? r.files : []
      console.log('[DSH Sidebar] files count: ' + files.length)
      render()
    }).catch(function (e) {
      console.log('[DSH Sidebar] loadFiles error:', e.message)
      list.innerHTML = '<div class="fb-msg err">' + esc(e.message) + '</div>'
    })
  }

  /* ── Detect workspace from page title ─────────────────── */
  function detectWorkspaceFromTitle() {
    var title = document.title || ''
    // Try multiple separators: em-dash, en-dash, hyphen, pipe
    var separators = [' \u2014 ', ' \u2013 ', ' - ', ' | ', ' \u00B7 ']
    for (var i = 0; i < separators.length; i++) {
      var idx = title.indexOf(separators[i])
      if (idx > 0) {
        var path = title.substring(0, idx).trim()
        if (path.indexOf(':') > 0 || path.indexOf('/') > 0 || path.indexOf('\\') > 0) {
          return path
        }
      }
    }
    // Also try: look for a drive letter pattern (e.g., X:\...)
    var driveMatch = title.match(/^([A-Z]:\\[^\s\u2014\u2013-]+)/)
    if (driveMatch) return driveMatch[1]
    // Try Unix path
    var unixMatch = title.match(/^(\/[^\s\u2014\u2013-]+)/)
    if (unixMatch) return unixMatch[1]
    return null
  }

  /* ── Render ───────────────────────────────────────────── */
  function render() {
    var list = document.getElementById('fb-list')
    if (!list) return
    if (files.length === 0) {
      list.innerHTML = '<div class="fb-msg">No files in workspace</div>'
      return
    }
    list.innerHTML = files.map(function (f) {
      var p = f.path || f.name || ''
      var name = f.name || p.split('/').pop() || p.split('\\').pop()
      var size = f.size ? fmtSize(f.size) : ''
      return '<div class="fb-row" data-p="' + esc(p) + '">' +
        '<span class="fb-row-icon">\uD83D\uDCC4</span>' +
        '<span class="fb-row-name" title="' + esc(p) + '">' + esc(name) + '</span>' +
        (size ? '<span class="fb-row-size">' + size + '</span>' : '') +
        '</div>'
    }).join('')
    list.querySelectorAll('.fb-row').forEach(function (r) {
      r.onclick = function () {
        list.querySelectorAll('.fb-row').forEach(function (x) { x.classList.remove('sel') })
        r.classList.add('sel')
        preview(r.dataset.p)
      }
    })
  }

  /* ── Preview ──────────────────────────────────────────── */
  function preview(path) {
    var pv = document.getElementById('fb-preview')
    var pp = document.getElementById('fb-ppath')
    var pb = document.getElementById('fb-pbody')
    if (!pv || !pp || !pb) return
    pv.classList.add('vis')
    pp.textContent = path
    pb.textContent = 'Loading\u2026'
    var full = workspacePath ? workspacePath + '/' + path : path
    api().getFileContent(full).then(function (r) {
      pb.textContent = (r && r.success) ? r.content : ((r && r.error) || 'Cannot read')
    }).catch(function (e) { pb.textContent = 'Error: ' + e.message })
  }

  /* ── Helpers ──────────────────────────────────────────── */
  function fmtSize(b) {
    if (b < 1024) return b + ' B'
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
    return (b / 1048576).toFixed(1) + ' MB'
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML }

  /* ── Public ───────────────────────────────────────────── */
  window.toggleDSHSidebar = toggle
  window.setDSHSidebarWorkspace = function (p) { workspacePath = p; if (isOpen) load() }

  /* ── Init ─────────────────────────────────────────────── */
  injectCSS()
  buildDOM()
  console.log('[DSH Sidebar] Ready — click 📁 Files to browse')
})()
