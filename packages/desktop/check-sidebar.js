const http = require('http');
const WebSocket = require('ws');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const pages = JSON.parse(data);
    const ws = pages[0].webSocketDebuggerUrl;
    const w = new WebSocket(ws);
    w.on('open', () => {
      w.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `JSON.stringify({
            hasTopbar: !!document.querySelector('.chat-workbench-topbar'),
            hasFilesBtn: !!document.querySelector('[aria-label="Files"]'),
            injected: window.__DSH_SIDEBAR_INJECTED__ || false,
            api: !!(window.electronAPI && window.electronAPI.sidebar),
            btnCount: document.querySelector('.chat-workbench-topbar') ? document.querySelector('.chat-workbench-topbar').querySelectorAll('button').length : 0,
            btnLabels: Array.from(document.querySelectorAll('.chat-workbench-topbar button')).map(b => b.getAttribute('aria-label'))
          })`,
          returnByValue: true
        }
      }));
    });
    w.on('message', (msg) => {
      const r = JSON.parse(msg);
      if (r.id === 1) {
        console.log(r.result?.result?.value || JSON.stringify(r));
        w.close();
        process.exit(0);
      }
    });
    setTimeout(() => { w.close(); process.exit(1); }, 5000);
  });
});
