import { defineConfig } from 'tsdown'
import { clientBundle } from '../../scripts/tsdown-client.ts'

export default defineConfig(clientBundle('ui-tool-registry', ['lib/types/index.js', 'lib/types/invariant.js']))