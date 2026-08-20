import { defineConfig } from 'tsdown'
import { clientBundle } from '../../scripts/tsdown-client.ts'

export default defineConfig(clientBundle('ui-theme-enhanced', ['lib/types/index.js', 'lib/types/invariant.js']))