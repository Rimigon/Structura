# Structura

[🇷🇺 Русский](./README.md) · [🇬🇧 English](./README.en.md)

Cross-platform file-structure tool: scan a folder, plan any operation (rename, move, flatten, dissolve, batch create) in a sandbox with a color-coded before / after diff, then apply everything as one transaction.

**Core rule:** nothing destructive touches disk until you press Apply.

Windows · macOS · Linux. Built with Tauri 2 (Rust) + React 18 + TypeScript + Tailwind + Shadcn UI.

## Features

### Core (P0)

- **Virtual tree** — scan via `jwalk` (parallel walk, ~10× faster than vanilla recursive walk on large trees).
- **Sandbox** — every action (rename, delete, move, copy, flatten, create) mutates the in-memory tree only. Disk stays untouched until `Ctrl+S`.
- **Before / after diff** — row highlighting: green = new, red = deleted, yellow = renamed, blue = moved.
- **Flatten** — two modes:
  - *Flatten into* — pulls files from the entire subtree into the chosen folder.
  - *Dissolve* — pushes the folder's contents up into its parent and deletes the folder itself.

  Deterministic conflict resolution (parent-prefix / counter / replace / skip / ask), per-file size cap, rename templates.
- **Copy / cut / paste** — `Ctrl+C` / `Ctrl+X` / `Ctrl+V` or context menu. Recursive directory copy preserving structure, multi-select aware.
- **JSON / Markdown / tab-indent** — import / export tree in three formats. Load from / save to file via native OS dialogs.
- **Smart search** — glob (`*.log`, `?.tsx`, `[abc]`). Two modes: highlight only, or filter (hide non-matches). "Select all" button for bulk actions.
- **Context menu** — open as root, new file / folder, rename (inline + by template), copy / cut / paste, flatten, dissolve, copy path, reveal in OS, delete.
- **Drag-and-drop** — grab any row. Dropping on a file targets that file's parent folder.
- **Safety** — single write command (`apply_transaction`), every path is validated inside the scan root, soft-delete to `.structura-trash/`, pre-flight disk-space check.

### Pro tools (P1)

- **Preset library** — Flatten configs with tags, stored in SQLite, survive restart. Bulk JSON export / import for machine-to-machine sync.
- **Transaction history** — last 20 applied transactions with full rollback: deleted files come back from `.structura-trash/`, moves reversed, copies / links deleted.
- **Undo / Redo** — unlimited in the sandbox via `zundo`.
- **20 color themes** — Structura Dark / Light, Dracula, Nord, Solarized Dark/Light, Tokyo Night, Catppuccin Mocha, Monokai, GitHub Dark/Light, One Dark/Light, Gruvbox Dark/Light, Rosé Pine / Dawn, Material Ocean, Cobalt2, Ayu Mirage.

### Automation (P2)

- **Duplicate finder** — SHA-256 across all files, grouped by size and hash, sorted by reclaimable space. Two actions: send duplicates to trash or merge via **hardlink** (0 new bytes, identical sha256, fully reversible).
- **Symlink / hardlink** — new transaction ops `symlink { from, to }` and `hardlink { from, to }`. Windows symlinks require Developer Mode or admin.
- **Folder watchers** — via the `notify` crate. Per-watcher rules `glob → preset`: on `create` events for files matching the mask, the preset auto-applies to the file's parent directory. Modes: notify-only (journal badge) or apply.
- **Batch rename by template** — triggered from a folder's context menu. Templates support `{file}`, `{base}`, `{ext}`, `{parent}`, `{grandparent}`, `{counter}` plus metadata `{exif_date}`, `{exif_camera}`, `{exif_lens}`, `{exif_width}`, `{exif_height}`, `{id3_artist}`, `{id3_title}`, `{id3_album}`, `{id3_year}`, `{id3_track}`. Live "before → after" preview with conflict highlighting.
- **Metadata** — automatic EXIF (photos) and ID3 (audio) readout when a file is focused, shown in the Properties panel.
- **Floating DnD widget** — separate 180×180 transparent always-on-top window. Drop a folder — it opens in Structura as the root.
- **Windows shell integration** — installable via Settings: "Open in Structura" on right-click of a folder and on blank space inside a folder (HKCU registry, no admin rights).

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
| Ctrl/Cmd + C | Copy selection to clipboard |
| Ctrl/Cmd + X | Cut selection to clipboard |
| Ctrl/Cmd + V | Paste into focused folder |
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

Apply op-ordering invariant: `mkdir` (parents first) → `touch` → `copy` → `rename` → `move` → `delete` (deepest first) → `hardlink/symlink`. Without this, Delete can race ahead of Move and break the transaction; a hardlink at a path being soft-deleted must be created after the delete.

## Status

v0 (P0 + P1 fully closed):

- Flatten / Dissolve, parsers (tab / MD / JSON), Import / Export to file
- Copy / cut / paste (recursive directory copy)
- Drag-drop, smart search, multi-select, multi-create
- SQLite presets with tags, JSON bulk export / import
- Transaction history + rollback, 20 themes, context menu
- Parallel scan, disk-space guard, soft-delete

v0.1 (P2):

- Hash-dedup with SHA-256 and hardlink merge
- Symlink / hardlink as transaction operations
- Folder watchers with glob rules and auto-apply presets
- Batch rename by template with EXIF / ID3 variables
- Metadata readout (EXIF / ID3) in Properties panel
- Floating DnD widget (secondary window)
- Windows shell integration (HKCU registry)

## License

MIT (LICENSE file pending).
