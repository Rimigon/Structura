use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::{params, Connection};
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

pub struct DbState(pub Mutex<Connection>);

pub fn init(app: &AppHandle) -> AppResult<Connection> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(format!("app_data_dir: {e}")))?;
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Io(e.to_string()))?;
    let path = db_path(&dir);
    let conn = Connection::open(&path).map_err(|e| AppError::Io(e.to_string()))?;
    migrate(&conn)?;
    Ok(conn)
}

fn db_path(app_data_dir: &std::path::Path) -> PathBuf {
    app_data_dir.join("structura.sqlite")
}

fn migrate(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS presets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          config_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL
        );
        CREATE TABLE IF NOT EXISTS preset_tags (
          preset_id TEXT NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (preset_id, tag_id),
          FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_preset_tags_tag ON preset_tags(tag_id);
        "#,
    )
    .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}

pub fn tag_ids_for_names(conn: &Connection, names: &[String]) -> AppResult<Vec<i64>> {
    let mut ids = Vec::with_capacity(names.len());
    for name in names {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            continue;
        }
        conn.execute(
            "INSERT OR IGNORE INTO tags(name) VALUES (?1)",
            params![trimmed],
        )
        .map_err(|e| AppError::Io(e.to_string()))?;
        let id: i64 = conn
            .query_row(
                "SELECT id FROM tags WHERE name = ?1",
                params![trimmed],
                |r| r.get(0),
            )
            .map_err(|e| AppError::Io(e.to_string()))?;
        ids.push(id);
    }
    Ok(ids)
}

pub fn tags_for_preset(conn: &Connection, preset_id: &str) -> AppResult<Vec<String>> {
    let mut stmt = conn
        .prepare(
            "SELECT t.name FROM tags t
             JOIN preset_tags pt ON pt.tag_id = t.id
             WHERE pt.preset_id = ?1
             ORDER BY t.name",
        )
        .map_err(|e| AppError::Io(e.to_string()))?;
    let rows = stmt
        .query_map(params![preset_id], |r| r.get::<_, String>(0))
        .map_err(|e| AppError::Io(e.to_string()))?;
    let mut tags = Vec::new();
    for r in rows {
        tags.push(r.map_err(|e| AppError::Io(e.to_string()))?);
    }
    Ok(tags)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_schema_in_memory() -> AppResult<()> {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn)?;
        conn.execute(
            "INSERT INTO presets(id,name,description,config_json,created_at,updated_at) VALUES('a','A',null,'{}',0,0)",
            [],
        )
        .unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM presets", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
        Ok(())
    }

    #[test]
    fn tag_ids_for_names_dedupes_and_inserts() -> AppResult<()> {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn)?;
        let ids = tag_ids_for_names(&conn, &[
            "alpha".into(),
            "  beta  ".into(),
            "alpha".into(),
            "".into(),
        ])?;
        assert_eq!(ids.len(), 3);
        let ids_set: std::collections::HashSet<_> = ids.iter().copied().collect();
        assert_eq!(ids_set.len(), 2);
        Ok(())
    }
}
