/**
 * File-backed settings provider using TOML format. One TOML document under the
 * user's harness home carries every namespace section; external edits hot-publish
 * through the seam, and every write re-reads the document under a
 * cross-process writer lock before patching it as a comment-preserving
 * leaf-level diff.
 * @module @deepseek-ai/dsh-settings-toml
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { watch as chokidarWatch } from 'chokidar'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { parse, stringify } from 'smol-toml'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { canonicalizeWatchPath, resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'

/** Plugin config: file location and hot-reload behavior. */
export interface Config {
  /** Settings document path; defaults to `settings.toml` under the harness home. */
  path?: string
  /** Harness home used when `path` is omitted; defaults to `$DSH_HOME` or `~/.dsh`. */
  dshHome?: string
  /** Watch the document and hot-publish external edits; defaults to true. */
  watch?: boolean
  /** Watcher write-settle window in milliseconds; defaults to 100. */
  debounceMs?: number
}

/** Document format derived from the configured file extension. */
type SettingsFormat = 'toml'

const FORMATS: Record<string, SettingsFormat> = {
  '.toml': 'toml',
}

/** Fully resolved provider parameters; defaulting happens here, never inline. */
interface ResolvedSpec {
  filename: string
  format: SettingsFormat
  watch: boolean
  debounceMs: number
}

/**
 * Resolve the runtime spec from plugin config: an explicit `path` wins,
 * otherwise the document lives at `<harness home>/settings.toml`.
 * @param config - raw plugin config.
 * @returns the resolved file location, format, and watch behavior.
 */
export function resolveSpec(config: Config): ResolvedSpec {
  const filename = resolve(config.path ?? join(resolveDshHome(config.dshHome), 'settings.toml'))
  const format = FORMATS[extname(filename)]
  if (format === undefined) {
    throw new Error(`settings-toml: extension "${extname(filename)}" is not supported (use .toml)`)
  }
  return {
    filename,
    format,
    watch: config.watch ?? true,
    debounceMs: config.debounceMs ?? 100,
  }
}

/** Whether a filesystem error means absence; every non-ENOENT failure must surface. */
function isENOENT(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT'
}

/** Whether an exclusive file create found an existing document. */
function isEEXIST(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'EEXIST'
}

/** File-backed settings provider using TOML format. */
export class TomlSettingsProvider extends SettingsProvider {
  static Config: z<Config> = z.object({
    path: z.string(),
    dshHome: z.string(),
    watch: z.boolean().default(true),
    debounceMs: z.number().min(0).default(100),
  })

  private readonly spec: ResolvedSpec
  /**
   * Raw text of the last successfully parsed or persisted document;
   * `undefined` while the file is absent. Watcher events whose content equals
   * this cache are no-ops, which is also the self-write suppression.
   */
  private text: string | undefined
  /**
   * Single exclusive operation chain: watcher reloads and document writes run
   * one at a time in queue order (settled tail), so a write can never render
   * from text a concurrent reload is busy replacing, and a reload can never
   * read a half-committed write.
   */
  private operations: Promise<void> = Promise.resolve()
  /** Set at dispose: refuse new watcher events and let in-flight work no-op. */
  private closed = false

  /** Opaque read of {@link closed}: control flow cannot narrow it across awaits. */
  private isClosed(): boolean {
    return this.closed
  }

  constructor(ctx: Context, public config: Config) {
    super(ctx)
    // Programmatic construction may bypass Schemastery normalization; resolve
    // the same defaults in one explicit step either way.
    this.spec = resolveSpec(config)
  }

  /** The local document is always writable through {@link SettingsProvider.update}. */
  get writable(): boolean {
    return true
  }

  /** The resolved TOML document path exposed to local configuration surfaces. */
  override get documentPath(): string {
    return this.spec.filename
  }

  /** Materialize an absent owner-only document, then return its resolved path. */
  override prepareDocument(): Promise<string> {
    return this.enqueue(async () => {
      await mkdir(dirname(this.spec.filename), { recursive: true, mode: 0o700 })
      await withFileLock(this.spec.filename, async () => {
        try {
          const { writeFile } = await import('node:fs/promises')
          await writeFile(this.spec.filename, '', { flag: 'wx', mode: 0o600 })
        } catch (error) {
          if (isEEXIST(error)) return
          throw error
        }
        this.text = ''
        if (!this.isClosed()) this.publish({})
      })
      return this.spec.filename
    })
  }

  protected async load(): Promise<Record<string, unknown>> {
    let text: string
    try {
      text = await readFile(this.spec.filename, 'utf8')
    } catch (error) {
      if (!isENOENT(error)) throw error
      this.text = undefined
      return {}
    }
    const doc = this.parse(text)
    this.text = text
    return doc
  }

  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    // One document backs every namespace, so writes from different namespace
    // queues serialize with each other and with watcher reloads on the one
    // operation chain: each render must see the text the previous operation
    // committed, or a sibling section silently vanishes from disk.
    return this.enqueue(() => this.persistSection(ns, section))
  }

  /** Queue one exclusive document operation behind every earlier one. */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.operations.then(operation)
    this.operations = task.then(() => undefined, () => undefined)
    return task
  }

  /** Queue a reload; only an invariant violation escaping a commit can reject it. */
  private queueRefresh(): void {
    if (this.isClosed()) return
    void this.enqueue(async () => {
      const text = await readFile(this.spec.filename, 'utf8')
      if (text === this.text) return
      const doc = this.parse(text)
      this.text = text
      this.publish(doc)
    })
  }

  private parse(text: string): Record<string, unknown> {
    if (text.trim() === '') return {}
    try {
      return parse(text) as Record<string, unknown>
    } catch (error) {
      throw new Error(`settings-toml: failed to parse TOML document: ${String(error)}`)
    }
  }

  private async persistSection(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    // The writer lock's exclusive create needs the parent to exist before
    // writeFileAtomic gets its own chance to create it.
    // 0700: the harness home holds user-private documents.
    await mkdir(dirname(this.spec.filename), { recursive: true, mode: 0o700 })
    await withFileLock(this.spec.filename, async () => {
      // Read-modify-write: fold in any on-disk state this process has not
      // observed yet — an external edit still inside the watcher debounce
      // window, a change the watcher missed, or another process's write — so
      // the render below can never resurrect a stale document. An unparsable
      // on-disk document fails the write loud instead of silently overwriting
      // a user's manual edit.
      await this.reconcileFromDisk()
      const output = this.renderToml(ns, section)
      // 0600: a document that may hold personal values is never world-readable.
      await writeFileAtomic(this.spec.filename, output, { mode: 0o600, dirMode: 0o700 })
      this.text = output
    })
  }

  override async* [Service.init](): AsyncGenerator<() => Promise<void> | void, void, void> {
    // The base init loads and publishes; a parse failure there is a boot
    // failure: an existing-but-invalid document must fail loud, never be
    // silently ignored or overwritten.
    yield* super[Service.init]()
    const watcher = this.spec.watch
      ? chokidarWatch(await canonicalizeWatchPath(this.spec.filename), {
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: this.spec.debounceMs,
          pollInterval: Math.max(1, Math.min(this.spec.debounceMs, 10)),
        },
      })
      : undefined
    if (watcher !== undefined) {
      watcher.on('all', () => {
        if (this.closed) return
        this.queueRefresh()
      })
      watcher.on('ready', () => {
        // The base init's load raced the watcher's own setup: a change written
        // between that read and the watcher becoming active never fires an
        // event. One reconcile at ready closes the gap.
        if (this.closed) return
        this.queueRefresh()
      })
      watcher.on('error', (error) => {
        this.ctx.logger.warn('settings-toml: watcher error on %s', this.spec.filename)
        this.ctx.logger.warn(error)
      })
    }
    yield async () => {
      // Quiesce every operation chain, even when no watcher is configured.
      this.closed = true
      await watcher?.close()
      await this.operations
    }
  }

  /**
   * Compare the on-disk text against the cache and publish any difference
   * into the seam. Absence publishes the empty document; an unreadable or
   * unparsable file throws, so each caller picks its policy — a reload warns
   * and keeps the last good document, a write fails loud.
   */
  private async reconcileFromDisk(): Promise<void> {
    let text: string | undefined
    try {
      text = await readFile(this.spec.filename, 'utf8')
    } catch (error) {
      if (!isENOENT(error)) throw error
      text = undefined
    }
    if (text === this.text || this.isClosed()) return
    if (text === undefined) {
      this.text = undefined
      this.publish({})
      return
    }
    const doc = this.parse(text)
    this.text = text
    this.publish(doc)
  }

  /**
   * Render the next TOML text by patching one namespace in the
   * comment-preserving document. The next section lands as a leaf-level diff
   * against the stored one — only changed values set, only removed keys
   * delete — so comments inside the section survive edits to their siblings,
   * not just comments outside it.
   */
  private renderToml(ns: SettingsNamespace, section: Record<string, unknown>): string {
    if (this.text === undefined) {
      return stringify({ [ns]: section })
    }
    // this.text only ever caches content that parsed successfully, so this
    // re-parse (for the mutable comment-preserving tree) cannot fail, and
    // parse() already rejected any non-map root.
    const doc = this.parse(this.text)
    doc[ns] = section
    return stringify(doc)
  }
}
