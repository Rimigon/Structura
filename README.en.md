# Structura

[🇷🇺 Русский](./README.md) · [🇬🇧 English](./README.en.md)

Cross-platform file-structure tool: scan a folder, plan any operation (rename, move, flatten, dissolve, batch create) in a sandbox with a color-coded before / after diff, then apply everything as one transaction.

**Core rule:** nothing destructive touches disk until you press Apply.

Windows · macOS · Linux. Built with Tauri 2 (Rust) + React 18 + TypeScript + Tailwind + Shadcn UI.

## Features (v0)

- **Virtual tree** — scan via `jwalk` (parallel walk, ~10× faster than vanilla recursive walk on large trees).
- **Sandbox** — every action (rename, delete, move, flatten, create) mutates the in-memory tree only. Disk stays untouched until `Ctrl+S`.
- **Before / after diff** — row highlighting: green = new, red = deleted, yellow = renamed, blue = moved.
- **Flatten** — two modes:
  - *Flatten into* — pulls files from the entire subtree into the chosen folder.
  - *Dissolve* — pushes the folder's contents up into its parent and deletes the folder itself.

  Deterministic conflict resolution, per-file size cap, rename templates (`{parent} — {file}`, `{parent}_{file}`, custom).
- **Drag-and-drop** — grab any row by any pixel. Dropping on a file targets that file's parent folder.
- **Smart search** — glob (`*.log`, `?.tsx`, `[abc]`). Two modes: highlight only, or filter (hide non-matches).
- **Context menu** — right-click a row: open as root, new file / folder, rename, flatten here, dissolve, copy path, reveal in OS, delete.
- **Text ↔ tree** — import / export as tab-indented, Markdown list, or JSON. Load from file / save to file via native OS dialogs.
- **Preset library** — Flatten configs with tags, stored in SQLite, survive restart.
- **Transaction history** — last 20 applied transactions with full rollback: deleted files come back from `.structura-trash/`, moves are reversed.
- **Undo / Redo** — unlimited in the sandbox via `zundo`.
- **20 color themes** — Structura Dark / Light, Dracula, Nord, Solarized Dark/Light, Tokyo Night, Catppuccin Mocha, Monokai, GitHub Dark/Light, One Dark/Light, Gruvbox Dark/Light, Rosé Pine / Dawn, Material Ocean, Cobalt2, Ayu Mirage. Picker is in the title bar (palette icon).
- **Safety** — single write command (`apply_transaction`), every path is validated inside the scan root, soft-delete to `.structura-trash/`, pre-flight disk-space check.

## Prerequisites

- **Node.js** 20+ and **pnpm** 9+
- **Rust** 1.77+ (install via [rustup](https://rustup.rs/))
- On **Linux**: `webkit2gtk-4.1`, `libayatana-appindicator3-dev`, `librsvg2-dev`
- On **Windows**: Microsoft Edge WebView2 Runtime (bundled on Windows 11)
- On **macOS**: Xcode Command Line Tools

See [Tauri prerequisites](https://tauri.app/start/prerequisites/) for full details.

## Setup

```sh
pnpm install
```

## Development

```sh
pnpm tauri:dev
```

Launches Vite dev server + the Tauri window with HMR on both sides (TS/React and Rust).

Or run the web UI standalone (no filesystem access):

```sh
pnpm dev
```

## Build

```sh
pnpm tauri:build
```

Produces native installers into `src-tauri/target/release/bundle/`.

## Test

```sh
pnpm test           # Vitest (TS) one-shot
pnpm test:watch     # Vitest watch
pnpm typecheck      # tsc --noEmit

cd src-tauri
cargo check
cargo test
```

Target coverage: ≥90% for pure functions in `src/core/`. Rust-side tests are critical for `safety.rs`, `fs_ops/*`, apply / disk commands.

## Keybinds

| Key | Action |
|-----|--------|
| Ctrl/Cmd + O | Open directory |
| Ctrl/Cmd + S | Apply changes to disk |
| Ctrl/Cmd + Z | Undo (sandbox) |
| Ctrl/Cmd + Shift + Z | Redo |
| Ctrl/Cmd + F | Focus tree search |
| F2 | Rename selected node |
| F5 | Rescan current root |
| Enter | New file in focused folder |
| Alt + Enter | New subfolder in focused folder |
| Tab / Shift + Tab | Indent / Outdent selected node |
| Delete | Soft-delete (into trash on apply) |
| Right-click | Context menu |

Letter shortcuts are bound to physical key codes (`KeyZ`, `KeyS`, etc.), so they work on any keyboard layout (including Cyrillic).

## Architecture

Three layers:

1. **Rust executor** (`src-tauri/`) — thin safe-primitive layer: walk, move, mkdir, touch, delete, rename. Never sees the virtual tree — only receives `Vec<Operation>` + `rootFsPath`.
2. **Pure core** (`src/core/`) — all algorithms (tree, parser, flatten, diff, transaction, search). No React / Tauri / DOM imports; all unit-tested with Vitest.
3. **UI** (`src/components/`, `src/stores/`) — React + Zustand. State split across a handful of stores (tree / selection / ui / preset / txHistory).

Apply op-ordering invariant: `mkdir` (parents first) → `touch` → `rename` → `move` → `delete` (deepest first). Without this, Delete can race ahead of Move and break the transaction.

## Status

v0 — working Flatten/Dissolve, parsers (tab/MD/JSON), Import/Export to file, drag-drop, smart search, SQLite presets, tx history + rollback, 20 themes, context menu, parallel scan, disk-space guard.

## License

MIT (LICENSE file pending).
