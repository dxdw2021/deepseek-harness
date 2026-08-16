/**
 * Import the preference of an already-logged-in opencode (opencodeai) account
 * into the harness credential document as OPENCODE_ZEN_API_KEY. This is the
 * "log in to OpenCode from the harness" entry point: it reuses the credential
 * your `opencode auth login opencode` stored, so the llm-opencode-zen route
 * can authenticate as that account instead of the anonymous free tier. The
 * secret never prints; enable the route by adding `apiKeyEnv:
 * OPENCODE_ZEN_API_KEY` to the llm-opencode-zen entry.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const KEY = 'OPENCODE_ZEN_API_KEY'
const credentialsPath = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), '.credentials.yaml')
const authCandidates = [
  join(homedir(), '.local', 'share', 'opencode', 'auth.json'),
  join(process.env.APPDATA ?? '', 'opencode', 'auth.json'),
]

function secretOf(auth) {
  const entry = auth?.opencode
  if (entry === undefined) return undefined
  if (entry.type === 'api' && typeof entry.key === 'string') return entry.key
  if (entry.type === 'oauth' && typeof entry.access === 'string') return entry.access
  return undefined
}

let auth
for (const path of authCandidates.filter(Boolean)) {
  if (!existsSync(path)) continue
  try {
    auth = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    // A malformed auth.json is the previous tool's problem; read on or report below.
  }
  break
}

const secret = secretOf(auth)
if (secret === undefined || secret.length < 8 || !/^[\x21-\x7E]+$/.test(secret)) {
  // The stored value is absent or cannot ride an HTTP header; a fresh
  // first-party login is the fix, not a blindly imported stale token.
  console.error(
    'login-opencode: no usable OpenCode credential found in opencode auth.json;'
    + ' run `opencode auth login opencode` first',
  )
  process.exit(1)
}

let doc = existsSync(credentialsPath) ? readFileSync(credentialsPath, 'utf8') : ''
if (new RegExp(`^${KEY}:`, 'm').test(doc)) {
  console.log(`login-opencode: ${KEY} already present in ${credentialsPath}; left unchanged.`)
  console.log(`Enable it: add  apiKeyEnv: ${KEY}  to the llm-opencode-zen entry.`)
  process.exit(0)
}
const sep = doc === '' || doc.endsWith('\n') ? '' : '\n'
writeFileSync(credentialsPath, `${doc}${sep}${KEY}: ${JSON.stringify(secret)}\n`, { mode: 0o600 })
console.log(`login-opencode: wrote ${KEY} into ${credentialsPath}.`)
console.log(`Enable it: add  apiKeyEnv: ${KEY}  to the llm-opencode-zen entry.`)
