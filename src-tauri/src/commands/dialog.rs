use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, FilePath};

use crate::error::{AppError, AppResult};

#[tauri::command]
pub async fn pick_directory(app: AppHandle) -> AppResult<Option<String>> {
    let (tx, rx) = std::sync::mpsc::channel::<Option<String>>();
    app.dialog().file().pick_folder(move |folder| {
        let result = folder.and_then(|f| f.into_path().ok()).map(|p| p.display().to_string());
        let _ = tx.send(result);
    });
    Ok(rx.recv().unwrap_or(None))
}

#[tauri::command]
pub async fn pick_open_file(
    app: AppHandle,
    filter_name: Option<String>,
    extensions: Option<Vec<String>>,
) -> AppResult<Option<String>> {
    let (tx, rx) = std::sync::mpsc::channel::<Option<String>>();
    let mut builder = app.dialog().file();
    if let (Some(name), Some(exts)) = (filter_name, extensions) {
        let ext_refs: Vec<&str> = exts.iter().map(|s| s.as_str()).collect();
        builder = builder.add_filter(&name, &ext_refs);
    }
    builder.pick_file(move |f: Option<FilePath>| {
        let r = f.and_then(|p| p.into_path().ok()).map(|p| p.display().to_string());
        let _ = tx.send(r);
    });
    Ok(rx.recv().unwrap_or(None))
}

#[tauri::command]
pub async fn pick_save_file(
    app: AppHandle,
    suggested_name: Option<String>,
    filter_name: Option<String>,
    extensions: Option<Vec<String>>,
) -> AppResult<Option<String>> {
    let (tx, rx) = std::sync::mpsc::channel::<Option<String>>();
    let mut builder = app.dialog().file();
    if let Some(name) = suggested_name {
        builder = builder.set_file_name(&name);
    }
    if let (Some(name), Some(exts)) = (filter_name, extensions) {
        let ext_refs: Vec<&str> = exts.iter().map(|s| s.as_str()).collect();
        builder = builder.add_filter(&name, &ext_refs);
    }
    builder.save_file(move |f: Option<FilePath>| {
        let r = f.and_then(|p| p.into_path().ok()).map(|p| p.display().to_string());
        let _ = tx.send(r);
    });
    Ok(rx.recv().unwrap_or(None))
}

#[tauri::command]
pub async fn read_text_file(path: String) -> AppResult<String> {
    std::fs::read_to_string(&path).map_err(|e| AppError::Io(e.to_string()))
}

#[tauri::command]
pub async fn write_text_file(path: String, content: String) -> AppResult<()> {
    std::fs::write(&path, content).map_err(|e| AppError::Io(e.to_string()))
}
