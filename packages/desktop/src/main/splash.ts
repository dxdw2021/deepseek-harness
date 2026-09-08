/**
 * DeepSeek Harness Desktop - Boot Page
 *
 * The main window's initial content, loaded before the dsh web server is up so
 * startup never shows a blank desktop. It mirrors the web app's own
 * "Loading plugins…" boot page, with the Uiverse "andrew-manzyk" pegtop
 * flower-sprinkle loader (dark background, three gradient flowers on timers)
 * and a status line set from the main process. The window swaps to the real
 * application URL once dsh web is ready — one window the whole way through.
 */

import type { BrowserWindow } from 'electron'

/** The secondary status element inside the boot page. */
const STATUS_ID = 'dsh-boot-status'

/** One falling flower from the Uiverse "andrew-manzyk" loader, keyed by id. */
function flowerSvg(id: string): string {
  return `
<svg id="${id}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <filter id="shine"><feGaussianBlur stdDeviation="3"></feGaussianBlur></filter>
    <mask id="mask">
      <path d="M63,37c-6.7-4-4-27-13-27s-6.3,23-13,27-27,4-27,13,20.3,9,27,13,4,27,13,27,6.3-23,13-27,27-4,27-13-20.3-9-27-13Z" fill="white"></path>
    </mask>
    <radialGradient id="gradient-1" cx="50" cy="66" fx="50" fy="66" r="30" gradientTransform="translate(0 35) scale(1 0.5)" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="black" stop-opacity="0.3"></stop>
      <stop offset="50%" stop-color="black" stop-opacity="0.1"></stop>
      <stop offset="100%" stop-color="black" stop-opacity="0"></stop>
    </radialGradient>
    <radialGradient id="gradient-2" cx="55" cy="20" fx="55" fy="20" r="30" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="white" stop-opacity="0.3"></stop>
      <stop offset="50%" stop-color="white" stop-opacity="0.1"></stop>
      <stop offset="100%" stop-color="white" stop-opacity="0"></stop>
    </radialGradient>
    <radialGradient id="gradient-3" cx="85" cy="50" fx="85" fy="50" xlink:href="#gradient-2"></radialGradient>
    <radialGradient id="gradient-4" cx="50" cy="58" fx="50" fy="58" r="60" gradientTransform="translate(0 47) scale(1 0.2)" xlink:href="#gradient-3"></radialGradient>
    <linearGradient id="gradient-5" x1="50" y1="90" x2="50" y2="10" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="black" stop-opacity="0.2"></stop>
      <stop offset="40%" stop-color="black" stop-opacity="0"></stop>
    </linearGradient>
  </defs>
  <g>
    <path d="M63,37c-6.7-4-4-27-13-27s-6.3,23-13,27-27,4-27,13,20.3,9,27,13,4,27,13,27,6.3-23,13-27,27-4,27-13-20.3-9-27-13Z" fill="currentColor"></path>
    <path d="M63,37c-6.7-4-4-27-13-27s-6.3,23-13,27-27,4-27,13,20.3,9,27,13,4,27,13,27,6.3-23,13-27,27-4,27-13-20.3-9-27-13Z" fill="url(#gradient-1)"></path>
    <path d="M63,37c-6.7-4-4-27-13-27s-6.3,23-13,27-27,4-27,13,20.3,9,27,13,4,27,13,27,6.3-23,13-27,27-4,27-13-20.3-9-27-13Z" fill="none" stroke="white" opacity="0.3" stroke-width="3" filter="url(#shine)" mask="url(#mask)"></path>
    <path d="M63,37c-6.7-4-4-27-13-27s-6.3,23-13,27-27,4-27,13,20.3,9,27,13,4,27,13,27,6.3-23,13-27,27-4,27-13-20.3-9-27-13Z" fill="url(#gradient-2)"></path>
    <path d="M63,37c-6.7-4-4-27-13-27s-6.3,23-13,27-27,4-27,13,20.3,9,27,13,4,27,13,27,6.3-23,13-27,27-4,27-13-20.3-9-27-13Z" fill="url(#gradient-3)"></path>
    <path d="M63,37c-6.7-4-4-27-13-27s-6.3,23-13,27-27,4-27,13,20.3,9,27,13,4,27,13,27,6.3-23,13-27,27-4,27-13-20.3-9-27-13Z" fill="url(#gradient-4)"></path>
    <path d="M63,37c-6.7-4-4-27-13-27s-6.3,23-13,27-27,4-27,13,20.3,9,27,13,4,27,13,27,6.3-23,13-27,27-4,27-13-20.3-9-27-13Z" fill="url(#gradient-5)"></path>
  </g>
</svg>`
}

const BOOT_PAGE_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body { height: 100%; }
  body {
    margin: 0;
    background: #0f1115;
    color: #e6e8eb;
    font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
    user-select: none;
  }
  .shell { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; }
  .logo { font-size: 30px; font-weight: 700; letter-spacing: 1px; color: #fff; }

  /* Loader: pegtop flower sprinkle by andrew-manzyk (Uiverse.io) */
  .loader {
    --fill-color: #5c3d99;
    --shine-color: #5c3d9933;
    transform: scale(0.8);
    width: 220px;
    height: 220px;
    position: relative;
    filter: drop-shadow(0 0 14px var(--shine-color));
  }
  .loader svg { overflow: hidden; border-radius: 50%; }
  .loader #pegtopone { position: absolute; animation: flowe-one 1s linear infinite; }
  .loader #pegtoptwo { position: absolute; opacity: 0; transform: scale(0) translateY(-200px) translateX(-100px); animation: flowe-two 1s linear infinite; animation-delay: 0.3s; }
  .loader #pegtopthree { position: absolute; opacity: 0; transform: scale(0) translateY(-200px) translateX(100px); animation: flowe-three 1s linear infinite; animation-delay: 0.6s; }
  .loader svg g path:first-child { fill: var(--fill-color); }

  @keyframes flowe-one {
    0% { transform: scale(0.5) translateY(-200px); opacity: 0; }
    25% { transform: scale(0.75) translateY(-100px); opacity: 1; }
    50% { transform: scale(1) translateY(0px); opacity: 1; }
    75% { transform: scale(0.5) translateY(50px); opacity: 1; }
    100% { transform: scale(0) translateY(100px); opacity: 0; }
  }
  @keyframes flowe-two {
    0% { transform: scale(0.5) rotateZ(-10deg) translateY(-200px) translateX(-100px); opacity: 0; }
    25% { transform: scale(1) rotateZ(-5deg) translateY(-100px) translateX(-50px); opacity: 1; }
    50% { transform: scale(1) rotateZ(0deg) translateY(0px) translateX(-25px); opacity: 1; }
    75% { transform: scale(0.5) rotateZ(5deg) translateY(50px) translateX(0px); opacity: 1; }
    100% { transform: scale(0) rotateZ(10deg) translateY(100px) translateX(25px); opacity: 0; }
  }
  @keyframes flowe-three {
    0% { transform: scale(0.5) rotateZ(10deg) translateY(-200px) translateX(100px); opacity: 0; }
    25% { transform: scale(1) rotateZ(5deg) translateY(-100px) translateX(50px); opacity: 1; }
    50% { transform: scale(1) rotateZ(0deg) translateY(0px) translateX(25px); opacity: 1; }
    75% { transform: scale(0.5) rotateZ(-5deg) translateY(50px) translateX(0px); opacity: 1; }
    100% { transform: scale(0) rotateZ(-10deg) translateY(100px) translateX(-25px); opacity: 0; }
  }

  .hint { font-size: 15px; color: #9aa3af; }
  .status { font-size: 13px; color: #6b7480; }
</style>
</head>
<body>
  <div class="shell">
    <div class="logo">HARNESS</div>
    <div class="loader">
      ${flowerSvg('pegtopone')}${flowerSvg('pegtoptwo')}${flowerSvg('pegtopthree')}
    </div>
    <div class="hint">Loading plugins…</div>
    <div id="${STATUS_ID}" class="status"></div>
  </div>
</body>
</html>`

/** Data URL the main window loads while the dsh web server is starting. */
export const BOOT_PAGE_URL = 'data:text/html;charset=utf-8,' + encodeURIComponent(BOOT_PAGE_HTML)

/**
 * Set the boot page's secondary status line (the first-launch preparation hint).
 * @param win - the main window currently showing the boot page.
 * @param text - the status text to display.
 */
export function setBootStatus(win: BrowserWindow | null, text: string): void {
  if (win === null || win.isDestroyed()) return
  const script = `document.getElementById(${JSON.stringify(STATUS_ID)}).textContent = ${JSON.stringify(text)}`
  void win.webContents.executeJavaScript(script).catch(() => {})
}
