pub mod commands;
pub mod db;
pub mod error;
pub mod fs_ops;
pub mod model;
pub mod safety;

use std::sync::Mutex;

use tauri::Manager;

use crate::db::DbState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let handle = app.handle();
            let conn = db::init(&handle).expect("failed to init sqlite");
            app.manage(DbState(Mutex::new(conn)));
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
            commands::list_presets,
            commands::upsert_preset,
            commands::delete_preset,
            commands::list_tags,
        ])
        .run(tauri::generate_context!())
        .expect("error while running structura");
}
