# Structura

Ultimate file management utility — visualize, transform, and automate directory structures in a sandbox before touching disk.

Cross-platform (Windows, macOS, Linux). Built with Tauri 2 (Rust) + React 18 + TypeScript + Tailwind + Shadcn UI.

## Features (v0)

- **Virtual Tree Engine** — scan a directory, manipulate it as an in-memory virtual tree. Parallel walk via `jwalk`.
- **Sandbox mode** — every change (rename, delete, move, flatten, create) mutates the virtual tree only. Nothing touches disk until you click Apply.
- **Before/After diff** — color-coded (green = new, red = deleted, yellow = renamed, blue = moved).
- **Flatten** — two modes (move files INTO a folder / dissolve a folder OUTwards), deterministic conflict resolution, optional rename templates (`{parent}-{file}` etc.).
- **Drag-and-drop** — drag any row to reorganize; drop on a file moves into its parent folder.
- **Smart Search** — glob (`*.log`, `?ile`, `[abc]`), highlight mode or filter mode (hide non-matches).
- **Context menu** — right-click a row for Open/Rename/New/Flatten/Dissolve/Copy path/Reveal in OS/Delete.
- **Text ↔ Tree** — import/export trees as tab-indented, Markdown, or JSON. Load from file and save to file supported.
- **SQLite preset library** — save Flatten configs with tags; survives restart.
- **Transaction history** — last 20 applied transactions, each fully rollback-able via precomputed inverse ops (`.structura-trash/` restoration).
- **Undo/Redo** — unlimited in the sandbox via `zundo`.
- **10 color themes** — dark, light, Dracula, Nord, Solarized, Tokyo Night, Catppuccin, Monokai, GitHub Light. Picker in the title bar.
- **Safety** — single `apply_transaction` write command; all paths validated against the scan root; soft deletes via `.structura-trash/`; disk-space pre-check.

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

Launches Vite dev server + the Tauri window with HMR on both sides.

Or run the web UI standalone (no file system access):

```sh
pnpm dev
```

## Build

```sh
pnpm tauri:build
```

Produces platform-native installers into `src-tauri/target/release/bundle/`.

## Test

```sh
pnpm test           # Vitest (TS) one-shot
pnpm test:watch     # Vitest watch
pnpm typecheck      # tsc --noEmit

cd src-tauri
cargo check
cargo test
```

## Project Structure

See [`CLAUDE.md`](./CLAUDE.md) for architecture, conventions, and navigation. Domain-specific details live in [`.claude/skills/`](./.claude/skills/).

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
| Delete | Soft-delete selected node |
| Right-click | Context menu |

All letter shortcuts use physical key codes, so they work on any keyboard layout (including Cyrillic).

## Status

v0 — working Flatten/Dissolve, Parser (tab/MD/JSON), Import/Export to file, drag-drop, smart search, SQLite presets, tx history + rollback, 10 color themes, context menu, parallel scan, disk-space guard. See `CLAUDE.md` → "Out of Scope for v0" for what's intentionally deferred.

## License

MIT (to be added).
