use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::error::{AppError, AppResult};

const WIDGET_LABEL: &str = "structura-widget";

#[tauri::command]
pub async fn open_floating_widget(app: AppHandle) -> AppResult<()> {
    if let Some(existing) = app.get_webview_window(WIDGET_LABEL) {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    let url = WebviewUrl::App("index.html#/widget".into());
    WebviewWindowBuilder::new(&app, WIDGET_LABEL, url)
        .title("Structura")
        .inner_size(180.0, 180.0)
        .resizable(false)
        .always_on_top(true)
        .decorations(false)
        .transparent(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e| AppError::Io(format!("widget window: {e}")))?;
    Ok(())
}

#[tauri::command]
pub async fn close_floating_widget(app: AppHandle) -> AppResult<()> {
    if let Some(win) = app.get_webview_window(WIDGET_LABEL) {
        let _ = win.close();
    }
    Ok(())
}
