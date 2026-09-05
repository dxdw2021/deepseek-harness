// Reasonix-aligned data model.
//
// These types mirror what the DeepSeek-Reasonix / DeepSeek-Harness backend
// surfaces for an agent session: a list of sessions, a transcript of user and
// assistant turns, each assistant turn carrying reasoning summaries, tool calls,
// and rich text; plus live session context/usage metrics. The shape is kept
// deliberately close to the harness session/event projection so the API adapter
// (src/lib/api.ts) can be mapped onto the real backend with minimal translation.

export type ThemeMode = 'dark' | 'light'

export type ComposerMode = 'normal' | 'delivery' | 'ask' | 'auto' | 'yolo'

export type ToolStatus = 'pending' | 'running' | 'success' | 'error'

export interface ToolCall {
  id: string
  name: string
  args: string // pretty-printed / summarized argument text
  result?: string
  status: ToolStatus
  durationMs?: number
}

export interface ReasoningSummary {
  id: string
  // Short headline shown when the card is collapsed, e.g. "临时产物已清理。"
  headline: string
  // Full chain-of-thought text revealed when expanded.
  detail?: string
  toolsCount: number
  thinkingCount: number
}

export type MessageRole = 'user' | 'assistant'

/** One durable image reference attached to a message (resolved via session.attachment). */
export interface MessageImage {
  attachmentId: string
  mediaType: string
  width?: number
  height?: number
  name?: string
}

export interface Message {
  id: string
  role: MessageRole
  // Markdown body for assistant turns; plain text for user turns.
  content: string
  createdAt: number
  // Assistant-only fields.
  reasoning?: ReasoningSummary[]
  tools?: ToolCall[]
  // User-uploaded images attached to this message (image content blocks).
  images?: MessageImage[]
  // User-uploaded text attachments (content blocks marked `<attachment name=...>`);
  // the body text is folded out of `content` so only the file names render.
  attachments?: { name: string }[]
  // Streaming flag: content/tool/tool results may still be arriving.
  streaming?: boolean
  // Optional status line e.g. "Ran for 12s · 3 tools".
  statusLine?: string
}

export interface Session {
  id: string
  title: string
  projectName: string
  /** Working directory the session runs in; used to start a new session in the same project. */
  cwd?: string
  updatedAt: number
  pinned?: boolean
}

export interface ContextUsage {
  usedPct: number // 0..100
  usedTokens: number
  capacityTokens: number
  compactionThresholdPct: number
}

export interface SessionMetrics {
  cacheHitPct: number // 0..100
  cost: number // currency units
  runTimeMs: number
  requestCount: number
  totalTokens: number
  turns: number
}

export interface TokenSlice {
  label: string
  tokens: number
  color: string
}

export interface TokenUsage {
  bySource: TokenSlice[]
  byType: TokenSlice[]
}

// A single server->client event, matching the harness WebSocket `events.mux`
// envelope (discriminated by `kind`).
export interface SessionEvent {
  /** Owning session id when the event came from the live multiplexed stream. */
  sessionId?: string
  kind:
    | 'message.append'
    | 'message.update'
    | 'reasoning.append'
    | 'tool.start'
    | 'tool.update'
    | 'context.update'
    | 'metrics.update'
    | 'session.open'
    | 'session.list'
  payload: unknown
}

// Result of `ApiClient.listSessions()`.
export interface ListSessionsResult {
  sessions: Session[]
}

// Result of `ApiClient.openSession(id)`.
export interface OpenSessionResult {
  session: Session
  messages: Message[]
  context: ContextUsage
  metrics: SessionMetrics
  tokenUsage: TokenUsage
}

export interface PromptResult {
  // Echoed/updated conversation after submitting a user prompt.
  messages: Message[]
}

/** One user-uploaded attachment queued on the composer (browser-owned). */
export interface PromptAttachment {
  /** Local display name (stripped of path info). */
  name: string
  /** `image` → sent as an image content block; `text` → read as UTF-8 and sent as text. */
  kind: 'image' | 'text'
  /** Image MIME type; png/jpeg/webp/gif are accepted by the host. */
  mediaType: string
  /** Canonical base64 of the image bytes (no `data:` URL prefix); set when kind === "image". */
  data: string
  /** Browser data URL used only for the inline image preview. */
  previewUrl: string
  /** UTF-8 file content; set when kind === "text". */
  textContent?: string
}

// A provider/model selection for a session (`session.models` / `session.selectModel`).
export interface ModelSelection {
  provider: string
  model: string
  reasoningEffort?: string
}

/** One redacted settings namespace view (`settings.describe` / `settings.update`). */
export interface SettingsNamespaceView {
  ns: string
  schema: unknown
  value: unknown
  base?: unknown
  user?: unknown
  applies: 'live' | 'restart'
  secrets: { path: string[]; set: boolean }[]
  revision: number
}

export interface SettingsDescribeResult {
  writable: boolean
  hasDocument: boolean
  namespaces: SettingsNamespaceView[]
}

/** Which side panel is open (sidebar footer entries). */
export type SidePanelKind = 'history' | 'memory' | 'mcp-skills' | 'settings'

/** One advisory model entry inside a provider group. */
export interface ModelCatalogEntry {
  id: string
  name: string
  description?: string
}

/** One successfully loaded provider group. */
export interface ModelProviderGroup {
  id: string
  name: string
  models: ModelCatalogEntry[]
}

/** One provider-local catalog failure. */
export interface ModelCatalogFailure {
  id: string
  name: string
  message: string
}

/** `session.models` value: current selection, routability and full catalog. */
export interface SessionModelsResult {
  current: ModelSelection | null
  routable: boolean
  groups: ModelProviderGroup[]
  failures: ModelCatalogFailure[]
}

/** One directory row of a `host.listDirectory` listing. */
export interface DirectoryEntry {
  name: string
  path: string
  hidden: boolean
}

/** `host.listDirectory` value: one directory level plus its ancestry. */
export interface DirectoryListing {
  path: string
  home: string
  crumbs: DirectoryEntry[]
  entries: DirectoryEntry[]
  truncated: boolean
}

/** One skill row of `skill.list`. */
export interface SkillEntry {
  name: string
  description: string
  whenToUse?: string
  modelInvocable: boolean
}

/** One `session.search` result row. */
export interface SessionSearchItem {
  sessionId: string
  snippet: string
}

export interface ApiClient {
  listSessions(): Promise<ListSessionsResult>
  openSession(id: string): Promise<OpenSessionResult>
  /** Create a session; `cwd` starts it in a specific project directory. */
  newSession(cwd?: string): Promise<OpenSessionResult>
  submit(
    sessionId: string,
    text: string,
    mode: ComposerMode,
    attachments?: PromptAttachment[],
  ): Promise<PromptResult>
  /** Enhance a draft prompt through the backend model; resolves to the enhanced text ("" on failure). */
  enhancePrompt(text: string): Promise<string>
  /** Query the session's current model selection and the routable model catalog. */
  listModels(sessionId: string): Promise<SessionModelsResult>
  /** Switch the session to the given provider/model; resolves to the accepted selection. */
  selectModel(sessionId: string, selection: ModelSelection): Promise<ModelSelection>
  /** List one directory level on the host for the in-app file browser (directories only). */
  listDirectory(path?: string): Promise<DirectoryListing>
  /** Open the host's native folder picker; resolves to the chosen path, or null when cancelled. */
  pickDirectory(): Promise<string | null>
  /** List the skills registered for a session. */
  listSkills(sessionId: string): Promise<SkillEntry[]>
  /** Full-text search across sessions (message content); returns sessionId + snippet. */
  searchSessions(query: string): Promise<SessionSearchItem[]>
  /** Resolve one durable image attachment by id; data is canonical base64. */
  readAttachment(
    sessionId: string,
    attachmentId: string,
  ): Promise<{ attachment: { mediaType: string; name?: string }; data: string }>
  /** Describe every settings namespace (redacted secrets). */
  settingsDescribe(): Promise<SettingsDescribeResult>
  /** Patch one settings namespace; resolves to the updated namespace view. */
  settingsUpdate(ns: string, patch: Record<string, unknown>, expectedRevision?: number): Promise<SettingsNamespaceView>
  // Subscribe to server events; returns an unsubscribe function.
  subscribe(
    onEvent: (event: SessionEvent) => void,
    onStatus: (connected: boolean) => void,
  ): () => void
}
