import fs from 'node:fs'
import path from 'node:path'

const files = []
const walk = (d) => {
  let e
  try { e = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
  for (const x of e) {
    const fp = path.join(d, x.name)
    if (x.isDirectory()) {
      if (['node_modules', 'lib'].includes(x.name)) continue
      walk(fp)
    } else if (/\.ts$/.test(x.name)) files.push(fp)
  }
}
walk('packages/settings')
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8')
  if (/settingsScope|\.set\(|partial/.test(c)) {
    console.log('FILE', f)
  }
}