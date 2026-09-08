# Agent Note: The desktop installer bundles a Node runtime

Status: implemented

English | [中文](2026-08-20-desktop-bundles-node-runtime.zh.md)

## Problem

The packaged desktop app runs `dsh web` (`lib/bin.js web --port 0`) as a plain Node child. When the host's Node was missing or older than 22.6, the shell fell back to Electron-as-node, which is unreliable for the runtime: koffi's FFI calls and junction handling misbehave, and an actual first-install slide showed `dsh web` exiting with `bin.js` failing the profile fallback heal. The result on end-user machines was the boot page sitting on "Loading plugins…" (or flashing a startup error) because a Node-less or old-Node host could never bring the server up under the fallback.

## Decision

The Windows installer ships a real Node runtime as an `extraResource` (`resources/node`, fetched by `scripts/ensure-node.mjs` from `nodejs.org`/`DSH_NODE_MIRROR`, pinned to `v24.12.0`/`DSH_NODE_VERSION`). `resolveNodeCommand` precedence is now: `DSH_RUNTIME_NODE` pin, then the bundled `resources/node/node.exe`, then a PATH Node that satisfies `>= 22.6`, then Electron-as-node. Production installs therefore run `dsh web` under a known-good Node and never take the Electron-as-node path; the bundled binary is Git-ignored and verified (`--version`) on every `build:dsh`.

## Alternatives considered

**Keep Electron-as-node as the only fallback.** Rejected: the runtime's koffi and junction code is documented unreliable there, and the failure window (boot page stuck, no console log) is exactly what made installed builds undiagnosable.

**Require the user to install Node.** Rejected: ordinary Windows users are not Node developers, and the packaged product must not depend on host tooling.

**Embed Electron's bundled Node unconditionally.** Rejected: Electron-as-node's fs/junction semantics still differ from a real Node process even at the same version, and the code-runtime worker needs `node:module` `stripTypeScriptTypes`, so a real Node is the supported contract.

## Consequences

The installer grows by the compressed Node artifact (~30 MB download, ~90 MB unpacked) and `build:dsh` needs network access to fetch it once (reused afterwards). Production boot is now deterministic across hosts with and without Node; `dsh web` startup is also faster than the Electron-as-node path. Only the Windows `win-x64` download is wired today; macOS/Linux builds still resolve Node from PATH and fall back to Electron-as-node until their downloads are added.