# Agent Note: WebUI one-click opencode account import

Status: implemented

English | [中文](2026-08-15-webui-opencode-login.zh.md)

## Problem

Getting the `opencode-zen` route onto an OpenCode account credential was a command-line step (`pnpm run login:opencode`): the web Models settings page had no discoverable way to log in. The page does not even render a curated editor for the `llm-opencode-zen` namespace — it shows the generic "other fields live in settings.yaml" hint, because `ui-settings-models` curates only `deepseek` and `pi-ai` families.

## Decision

Add the import as a first-class wire method plus a web button.

- **Host API**: `LlmApi.importOpencodeCredential` (`packages/host/apiproxy/src/api/llm.ts`), registered in `rpc-map.ts`, with request/value zod schemas (`llm.schema.ts`), the `fetch/handler.ts` route, and the `fetch/client.ts` carrier method. The implementation reads the opencode CLI's `auth.json` (candidates: `~/.local/share/opencode/auth.json`, `%APPDATA%\opencode\auth.json`), takes the `opencode` entry (`api` → `key`, `oauth` → `access`), format-checks it like every other harness credential, and writes it into the harness credentials seam under `OPENCODE_ZEN_API_KEY`. The secret never crosses the wire in either direction; the reply only reports `imported` / `alreadyPresent`. Absent store, no credential, or an already-present value answer `err('bad-request', …)` / `ok({ alreadyPresent: true })` respectively.
- **Web UI**: `ui-settings-models` gains an `opencode-zen` layout (the existing `deepseek`/`pi-ai` families stay untouched). The card renders an "Import from opencode login" button that drives the new method and shows success/present/error copy inline (`locales.ts` en + zh); the footer submit stays disabled because this card has nothing to apply.

## Alternatives considered

- **Device-flow OAuth inside the harness.** The authoritative login would mint account tokens via console.opencode.ai's flow, but its endpoints are the opencode CLI/console's moving contract, and the account tier's free allowances are already covered by a proper API key once stored. Deferred: the CLI-import path covers the login entry now.
- **Settings-only no-UI.** Not discoverable in the web surface the user asked for.

## Consequences

The wire grows one `llm.importOpencodeCredential` unary; every carrier and test fake implementing `IApiClient['llm']` carries it. The button imports the *stored* CLI credential — it still does not unlock the anonymous tier's popular-model quotas, which remain keyed on the client `User-Agent` (see the adapter note); the account key is for account-scoped allowances and paid tiers. The GUI change carries the standard obligations for the PR: `test:gui` plus the web replay snapshot, and a recorded GIF for product-visible behavior.