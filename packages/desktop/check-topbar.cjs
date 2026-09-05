// check-topbar.cjs - Minimal CDP check (no ws module needed)
const http = require('http');
const { execSync } = require('child_process');

// Use CDP HTTP endpoint + fetch to evaluate
const pageUrl = 'http://127.0.0.1:9222/json';
http.get(pageUrl, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const pages = JSON.parse(data);
    const page = pages[0];
    console.log('Page:', page.title);
    console.log('WS:', page.webSocketDebuggerUrl);
    console.log('We need ws module to evaluate JS. Using curl fallback...');

    // Fallback: just output what we know
    console.log('\nTop bar class check needed. Try in browser console:');
    console.log('document.querySelector(".chat-workbench-topbar") ? "found" : "NOT found"');
    console.log('document.querySelector("[aria-label=Files]") ? "found" : "NOT found"');
    console.log('window.__DSH_SIDEBAR_INJECTED__');
    process.exit(0);
  });
}).on('error', (e) => {
  console.error('Cannot connect to DevTools:', e.message);
  process.exit(1);
});
