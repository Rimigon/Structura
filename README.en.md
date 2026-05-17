# Structura

[🇷🇺 Русский](./README.md) · [🇬🇧 English](./README.en.md)

Cross-platform file-structure tool: scan a folder, plan any operation (rename, move, flatten, dissolve, batch create, template-driven batch rename) in a sandbox with a color-coded before / after diff, then apply everything as one transaction.

**Core rule:** nothing destructive touches disk until you press Apply.

Windows · macOS · Linux. Built with Tauri 2 (Rust) + React 18 + TypeScript + Tailwind + Shadcn UI. The UI is bilingual: Russian (default) / English.

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
- **In-file content search** — checkbox in the search bar enables a full-text backend scan (up to 10 MB per file, binary files skipped, max 5000 hits). Matches merge with name-based search.
- **Context menu** — open as root, new file / folder, rename (inline + by template), copy / cut / paste, copy names / paths of selection, flatten, dissolve, copy path, reveal in OS, delete. Right-clicking a row that is already part of a multi-selection keeps the selection — mass actions operate on the whole set.
- **Auto-unique names** — three new files with the default name become `new-file`, `new-file (2)`, `new-file (3)`, not silently coalesced on Apply.
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
- **Batch rename by template** — two modes:
  - on a folder (right-click → "Rename by template…") — renames its children;
  - on a multi-selection ("Rename selected (N) by template…") — works on an arbitrary set of files drawn from different parents; conflict checks run per parent.

  Templates support `{file}`, `{name}` (alias for `{base}`), `{base}`, `{ext}`, `{parent}`, `{grandparent}`, `{n}` / `{counter}`, `{n:02}`, `{n:03}`, `{n:04}` (zero-padded counter), `{date}`, `{datetime}`, `{year}`, `{month}`, `{day}`, `{hour}`, `{minute}`, plus metadata `{exif_date}`, `{exif_camera}`, `{exif_lens}`, `{exif_width}`, `{exif_height}`, `{id3_artist}`, `{id3_title}`, `{id3_album}`, `{id3_year}`, `{id3_track}`. 25 ready-made presets organized into 6 categories: general / numbered / photo / music / video / documents.
- **Metadata** — automatic EXIF (photos) and ID3 (audio) readout when a file is focused, shown in the Properties panel.
- **Floating DnD widget** — separate 180×180 transparent always-on-top window with its own capability file (permissions for window dragging + event emit/listen). Drop a folder — it opens in Structura as the root.
- **Windows shell integration** — installable via Settings: "Open in Structura" on right-click of a folder and on blank space inside a folder (HKCU registry, no admin rights).

### UI & customization (v0.2)

- **Bilingual UI** — Russian (default) / English, switch in Settings → Language. Dictionary in `src/lib/i18n.ts`, 250+ keys cover the whole UI. New files / folders created under English locale are named `new-file` / `new-folder`.
- **Help & instructions** — book icon in the toolbar (or `F1`): 5 tabs — Quick Start, Features, Hotkeys (live list of bindings), Templates (full variable reference), FAQ.
- **Customisable hotkeys** — Settings → Hotkeys: click a chip + press keys → new binding, `Esc` to cancel, `Delete` to reset that row, "Reset all" button. 17 actions. Stored in `uiStore`, matched on `e.code` — stable across keyboard layouts.
- **Visual Apply dialog** — 6 metric cards (total / +added / →moved / ~renamed / ×removed / estimated size) double as filter tabs. Renames and moves render with a split "from → to" preview that highlights the shared path prefix. Separate file / dir counters. Disk-space indicator with status icon.

## Install from a pre-built release

The simplest path — grab an installer from the **[Releases](../../releases)** page and run it. Building from source is only needed for contributors (see the next section).

### Windows

1. From the release page, download `Structura_<version>_x64-setup.exe` (NSIS, smaller) or `Structura_<version>_x64_en-US.msi` (classic MSI).
2. Run it. Windows SmartScreen may warn "Unknown publisher" — click **"More info → Run anyway"**. The installer is not signed with an EV certificate (overkill for a pet project), but the binary is built on GitHub Actions and a checksum is published next to the asset for verification.
3. To use symlink operations, enable Developer Mode: `Settings → Privacy & Security → For developers → Developer Mode`. Without it, Windows symlinks require running the app as admin.

### macOS

1. Download `Structura_<version>_universal.dmg` — universal build for Intel and Apple Silicon.
2. Open the `.dmg`, drag `Structura.app` into `Applications`.
3. On first launch macOS may say **"Structura is damaged and can't be opened"** — this is the Gatekeeper quarantine flag, not actual damage. Remove it with one command in Terminal:
   ```sh
   xattr -cr /Applications/Structura.app
   ```
   The app is not signed (an Apple Developer ID costs $99/year), so Gatekeeper blocks it by default. The command above strips the quarantine attribute and macOS will launch the app.

### Linux

- **Debian / Ubuntu (`.deb`):**
  ```sh
  sudo dpkg -i structura_<version>_amd64.deb
  sudo apt -f install   # pulls missing deps if dpkg complains
  ```
- **Any distro (AppImage):**
  ```sh
  chmod +x Structura_<version>_amd64.AppImage
  ./Structura_<version>_amd64.AppImage
  ```
  The AppImage needs no installation and runs from anywhere.

### How releases are built

The workflow at `.github/workflows/release.yml` triggers on every push of a `v*` tag. It spins up three GitHub Actions runners (`windows-latest`, `macos-latest`, `ubuntu-22.04`), runs `pnpm tauri:build` on each, and creates a draft release with all artifacts auto-uploaded: `.msi` + `-setup.exe` (Windows), `.dmg` + `.app.tar.gz` (macOS universal), `.deb` + `.AppImage` (Linux).

To cut a new version (for maintainers):

```sh
# 1. Bump the version in all three files in sync:
#    package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml

# 2. Commit and push
git commit -am "chore: bump version to 0.3.0"
git push

# 3. Tag and push the tag (pushing the tag is what triggers the workflow)
git tag v0.3.0
git push origin v0.3.0
```

After ~15–20 minutes there will be three green builds under `Actions` and a draft release under `Releases`. Add a changelog and publish.

### Auto-updates (`tauri-plugin-updater`)

Structura can check GitHub Releases for a newer version and install a signed installer with one click. To make this work, the maintainer must generate a signing keypair once and store it as repo secrets.

1. **Generate the ed25519 keypair**:
   ```sh
   pnpm tauri signer generate -w ~/.tauri/structura-updater.key
   # Windows PowerShell:
   # pnpm tauri signer generate -w $env:USERPROFILE\.tauri\structura-updater.key
   ```
   You'll be asked for a password. Two files are created:
   - `structura-updater.key` — private (**never commit**)
   - `structura-updater.key.pub` — public

2. **Paste the public key** into `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`, replacing `REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY` with the single base64 string from `.pub`.

3. **Add GitHub Secrets** (`Settings → Secrets and variables → Actions → New repository secret`):
   - `TAURI_SIGNING_PRIVATE_KEY` — full contents of `structura-updater.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password from step 1

4. **Publish the release** (you must hit *Publish* on the draft — leaving it as draft makes `releases/latest/download/...` return 404). `tauri-action` automatically adds a signed `latest.json` next to the installers.

The endpoint the app polls is set in `tauri.conf.json`:
```
https://github.com/Rimigon/Structura/releases/latest/download/latest.json
```

On the client side the check is enabled by default (Settings → Updates) and runs at most once every 24 hours. Users can disable auto-check or run "Check now" at any time.

## Prerequisites & from-scratch setup

### Dependencies at a glance

| Component | Version | Why |
|-----------|---------|-----|
| Node.js | 20+ (LTS) | Frontend build, Vite, Vitest |
| pnpm | 9+ | Package manager |
| Rust | 1.77+ | Tauri backend and native commands |
| OS Tauri deps | platform-specific | See below |

### Windows (from scratch)

1. **Install Microsoft Visual Studio Build Tools** — needed for the MSVC linker. [Download](https://visualstudio.microsoft.com/visual-cpp-build-tools/). Pick the *"Desktop development with C++"* workload.
2. **Install WebView2 Runtime** — already bundled on Windows 10 21H2+ and Windows 11. Otherwise use the [Evergreen installer](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).
3. **Install Rust** via rustup:
   ```powershell
   winget install Rustlang.Rustup
   # or grab https://rustup.rs/ and run rustup-init.exe
   rustup default stable
   ```
4. **Install Node.js 20+**:
   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```
5. **Install pnpm**:
   ```powershell
   npm install -g pnpm
   ```
6. **(optional, for symlink ops)** Enable Developer Mode: `Settings → Privacy & Security → For developers → Developer Mode`. Without it, Windows symlinks require running the app as admin.
7. **Clone and install**:
   ```powershell
   git clone <repo-url> Structura
   cd Structura
   pnpm install
   pnpm tauri:dev
   ```

### macOS (from scratch)

1. **Install Xcode Command Line Tools**:
   ```sh
   xcode-select --install
   ```
2. **Homebrew** (if not already installed):
   ```sh
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
3. **Node.js + pnpm + Rust**:
   ```sh
   brew install node@20 pnpm rustup-init
   rustup-init -y
   source "$HOME/.cargo/env"
   ```
4. **Clone and install**:
   ```sh
   git clone <repo-url> Structura
   cd Structura
   pnpm install
   pnpm tauri:dev
   ```

### Linux (Ubuntu / Debian, from scratch)

1. **Tauri system libraries** (WebKit, AppIndicator, SVG):
   ```sh
   sudo apt update
   sudo apt install -y \
     libwebkit2gtk-4.1-dev \
     libayatana-appindicator3-dev \
     librsvg2-dev \
     build-essential \
     curl \
     wget \
     file \
     libssl-dev \
     libxdo-dev \
     libgtk-3-dev
   ```
   Fedora / RHEL analogues: `webkit2gtk4.1-devel`, `libappindicator-gtk3-devel`, `librsvg2-devel`, `gtk3-devel`.
2. **Rust**:
   ```sh
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
   source "$HOME/.cargo/env"
   ```
3. **Node.js 20+ and pnpm**:
   ```sh
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
   sudo apt install -y nodejs
   sudo npm install -g pnpm
   ```
4. **Clone and install**:
   ```sh
   git clone <repo-url> Structura
   cd Structura
   pnpm install
   pnpm tauri:dev
   ```

Full OS matrix in [Tauri prerequisites](https://tauri.app/start/prerequisites/).

## Scripts

| Script | What it does |
|--------|--------------|
| `pnpm install` | Installs all npm deps |
| `pnpm dev` | Vite dev server only (browser debug, no FS access) |
| `pnpm tauri:dev` | Vite + Tauri window with HMR on both sides (TS/React and Rust) |
| `pnpm build` | Typecheck + production frontend bundle to `dist/` |
| `pnpm tauri:build` | Native installers for the current OS into `src-tauri/target/release/bundle/` |
| `pnpm test` | Vitest (TS) one-shot |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm typecheck` | `tsc --noEmit` |
| `cd src-tauri && cargo check` | Quick Rust compile check |
| `cd src-tauri && cargo test` | Rust unit tests (fs_ops, safety, commands) |

## Hotkeys (defaults)

Everything is remappable in Settings → Hotkeys. Values below are the factory defaults.

| Key | Action |
|-----|--------|
| Ctrl/Cmd + O | Open directory |
| Ctrl/Cmd + S | Apply changes to disk |
| Ctrl/Cmd + Z | Undo (sandbox) |
| Ctrl/Cmd + Y or Ctrl+Shift+Z | Redo |
| Ctrl/Cmd + F | Focus tree search |
| Ctrl/Cmd + C | Copy selection to clipboard |
| Ctrl/Cmd + X | Cut selection to clipboard |
| Ctrl/Cmd + V | Paste into focused folder |
| Ctrl/Cmd + Shift + C | Copy names of selected nodes (newline-separated) |
| F1 | Help & instructions |
| F2 | Rename selected node (inline) |
| F5 | Rescan current root |
| Enter | New file in focused folder |
| Alt + Enter | New subfolder in focused folder |
| Tab / Shift + Tab | Indent / Outdent selected node |
| Delete | Soft-delete (into trash on apply) |
| Right-click | Context menu |

Letter shortcuts are bound to physical key codes (`KeyZ`, `KeyS`, etc.), so they work on any keyboard layout (including Cyrillic).

## Architecture

Three layers:

1. **Rust executor** (`src-tauri/`) — thin safe-primitive layer: walk, move, mkdir, touch, delete, rename, copy, hardlink, symlink, search-content. Never sees the virtual tree — only receives `Vec<Operation>` + `rootFsPath`.
2. **Pure core** (`src/core/`) — all algorithms (tree, parser, flatten, diff, transaction, search). No React / Tauri / DOM imports; all unit-tested with Vitest.
3. **UI** (`src/components/`, `src/stores/`, `src/hooks/`, `src/lib/`) — React + Zustand. State split across stores (tree / selection / ui / preset / txHistory / watcher). i18n, hotkey config, and locale live in `uiStore`.

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

v0.2 (UI / localisation / quality):

- Bilingual UI (RU/EN) with runtime switching
- Help dialog with 5 tabs (quick start, features, hotkeys, templates, FAQ)
- Customisable hotkeys with a visual editor
- Apply dialog with metric cards and per-kind filters
- Batch rename: 25 presets in 6 categories, padded counter `{n:02}`/`{n:03}`/`{n:04}`, date/time, multi-select mode
- Full-text search inside files (Rust command with binary sniff)
- Mass copy of names and paths, multi-select preserved on right-click
- Auto-unique names on creation (`new-file`, `new-file (2)`, `new-file (3)`…)
- Fixed watcher-dialog (stable empty-array selector) and batch-rename scroll

## License

MIT (LICENSE file pending).
