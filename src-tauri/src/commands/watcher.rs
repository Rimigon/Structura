use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

use crate::error::{AppError, AppResult};

pub struct WatcherRegistry(pub Mutex<HashMap<String, WatcherEntry>>);

pub struct WatcherEntry {
    pub path: PathBuf,
    pub recursive: bool,
    #[allow(dead_code)]
    pub watcher: RecommendedWatcher,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WatchInfo {
    pub id: String,
    pub path: String,
    pub recursive: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WatchEventPayload {
    pub watch_id: String,
    pub kind: String,
    pub paths: Vec<String>,
    pub timestamp: i64,
}

#[tauri::command]
pub async fn subscribe_watch(
    app: AppHandle,
    state: State<'_, WatcherRegistry>,
    path: String,
    recursive: Option<bool>,
) -> AppResult<String> {
    let p = PathBuf::from(&path);
    if !p.is_dir() {
        return Err(AppError::NotFound { path });
    }
    let id = Uuid::new_v4().to_string();
    let id_for_thread = id.clone();
    let app_handle = app.clone();

    let mut watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
        if let Ok(event) = res {
            let kind = kind_label(&event.kind);
            let payload = WatchEventPayload {
                watch_id: id_for_thread.clone(),
                kind: kind.into(),
                paths: event
                    .paths
                    .iter()
                    .map(|p| p.display().to_string())
                    .collect(),
                timestamp: chrono::Utc::now().timestamp_millis(),
            };
            let _ = app_handle.emit("watch-event", payload);
        }
    })
    .map_err(|e| AppError::Io(format!("watcher init: {e}")))?;

    let mode = if recursive.unwrap_or(true) {
        RecursiveMode::Recursive
    } else {
        RecursiveMode::NonRecursive
    };
    watcher
        .watch(&p, mode)
        .map_err(|e| AppError::Io(format!("watch start: {e}")))?;

    let mut map = state.0.lock().map_err(|e| AppError::Io(e.to_string()))?;
    map.insert(
        id.clone(),
        WatcherEntry {
            path: p,
            recursive: recursive.unwrap_or(true),
            watcher,
        },
    );
    Ok(id)
}

#[tauri::command]
pub async fn unsubscribe_watch(
    state: State<'_, WatcherRegistry>,
    id: String,
) -> AppResult<()> {
    let mut map = state.0.lock().map_err(|e| AppError::Io(e.to_string()))?;
    map.remove(&id);
    Ok(())
}

#[tauri::command]
pub async fn list_watches(state: State<'_, WatcherRegistry>) -> AppResult<Vec<WatchInfo>> {
    let map = state.0.lock().map_err(|e| AppError::Io(e.to_string()))?;
    Ok(map
        .iter()
        .map(|(id, e)| WatchInfo {
            id: id.clone(),
            path: e.path.display().to_string(),
            recursive: e.recursive,
        })
        .collect())
}

fn kind_label(kind: &EventKind) -> &'static str {
    match kind {
        EventKind::Create(_) => "create",
        EventKind::Modify(_) => "modify",
        EventKind::Remove(_) => "remove",
        EventKind::Access(_) => "access",
        EventKind::Other => "other",
        EventKind::Any => "any",
    }
}

// Helper to allow initialization from lib.rs (AppHandle available at setup)
pub fn install_registry(app: &AppHandle) {
    app.manage(WatcherRegistry(Mutex::new(HashMap::new())));
    let _ = Path::new("");
}
