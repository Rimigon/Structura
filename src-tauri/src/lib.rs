pub mod commands;
pub mod db;
pub mod error;
pub mod fs_ops;
pub mod model;
pub mod safety;

use std::sync::Mutex;

use tauri::{Emitter, Manager};

use crate::db::DbState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let handle = app.handle();
            let conn = db::init(&handle).expect("failed to init sqlite");
            app.manage(DbState(Mutex::new(conn)));
            commands::watcher::install_registry(&handle);

            // If launched with a folder argument (e.g. from the Windows shell
            // integration), emit it once the frontend is mounted so it can
            // scanRoot() into that directory. The args.next() skips argv[0].
            let mut argv = std::env::args();
            let _exe = argv.next();
            if let Some(path) = argv.next() {
                let trimmed = path.trim().to_string();
                if !trimmed.is_empty() && !trimmed.starts_with("--") {
                    let h = handle.clone();
                    std::thread::spawn(move || {
                        // Give the webview a moment to mount its event listener.
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        let _ = h.emit("open-folder-arg", trimmed);
                    });
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_directory,
            commands::stat_path,
            commands::pick_directory,
            commands::pick_open_file,
            commands::pick_save_file,
            commands::read_text_file,
            commands::write_text_file,
            commands::apply_transaction,
            commands::reveal_in_os,
            commands::check_disk_space,
            commands::find_duplicates,
            commands::subscribe_watch,
            commands::unsubscribe_watch,
            commands::list_watches,
            commands::open_floating_widget,
            commands::close_floating_widget,
            commands::extract_metadata,
            commands::get_thumbnail,
            commands::shell_integration_status,
            commands::install_shell_integration,
            commands::uninstall_shell_integration,
            commands::restart_explorer,
            commands::list_presets,
            commands::upsert_preset,
            commands::delete_preset,
            commands::list_tags,
            commands::search_content,
        ])
        .run(tauri::generate_context!())
        .expect("error while running structura");
}
