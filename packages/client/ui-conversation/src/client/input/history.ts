/**
 * Per-session prompt history: tracks submitted drafts and supports
 * UP/DOWN navigation through them. Entries are stored newest-first.
 * Index -1 means the navigation is at the bottom — the user's current
 * draft, captured as `pending` on the first UP press.
 */
export class PromptHistory {
  private entries: string[] = []
  private index = -1
  private pending = ''

  /** Push one submitted draft to the front of the history. Empty and duplicate entries are skipped. */
  push(draft: string): void {
    if (draft.trim() === '') return
    if (this.entries.length > 0 && this.entries[0] === draft) return
    this.entries.unshift(draft)
  }

  /**
   * Navigate backwards (UP). First call captures the current draft as
   * the pending fallback for DOWN-to-bottom. Returns null at the oldest
   * entry or when history is empty.
   * @param current - the draft currently in the textarea.
   * @returns the previous draft, or null when navigation is exhausted.
   */
  up(current: string): string | null {
    if (this.entries.length === 0) return null
    if (this.index === -1) {
      this.pending = current
      this.index = 0
    } else if (this.index < this.entries.length - 1) {
      this.index += 1
    } else {
      return null
    }
    return this.entries[this.index]
  }

  /**
   * Navigate forwards (DOWN). Returns null when not in a navigation
   * session (index === -1). At index 0, returns the pending draft and
   * resets the index to -1.
   * @returns the next draft, or null when not navigating or at the bottom.
   */
  down(): string | null {
    if (this.index < 0) return null
    if (this.index === 0) {
      this.index = -1
      return this.pending
    }
    this.index -= 1
    return this.entries[this.index]
  }
}