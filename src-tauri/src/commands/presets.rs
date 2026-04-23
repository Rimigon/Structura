use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{tag_ids_for_names, tags_for_preset, DbState};
use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetRow {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub config_json: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub tags: Vec<String>,
}

#[tauri::command]
pub async fn list_presets(state: State<'_, DbState>) -> AppResult<Vec<PresetRow>> {
    let conn = state.0.lock().map_err(|e| AppError::Io(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, config_json, created_at, updated_at
             FROM presets ORDER BY updated_at DESC, name",
        )
        .map_err(|e| AppError::Io(e.to_string()))?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, i64>(5)?,
            ))
        })
        .map_err(|e| AppError::Io(e.to_string()))?;
    let mut result = Vec::new();
    for row in rows {
        let (id, name, description, config_json, created_at, updated_at) =
            row.map_err(|e| AppError::Io(e.to_string()))?;
        let tags = tags_for_preset(&conn, &id)?;
        result.push(PresetRow {
            id,
            name,
            description,
            config_json,
            created_at,
            updated_at,
            tags,
        });
    }
    Ok(result)
}

#[tauri::command]
pub async fn upsert_preset(state: State<'_, DbState>, preset: PresetRow) -> AppResult<()> {
    let mut conn = state.0.lock().map_err(|e| AppError::Io(e.to_string()))?;
    let tx = conn
        .transaction()
        .map_err(|e| AppError::Io(e.to_string()))?;
    tx.execute(
        "INSERT INTO presets(id, name, description, config_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name,
           description=excluded.description,
           config_json=excluded.config_json,
           updated_at=excluded.updated_at",
        params![
            preset.id,
            preset.name,
            preset.description,
            preset.config_json,
            preset.created_at,
            preset.updated_at,
        ],
    )
    .map_err(|e| AppError::Io(e.to_string()))?;

    tx.execute(
        "DELETE FROM preset_tags WHERE preset_id = ?1",
        params![preset.id],
    )
    .map_err(|e| AppError::Io(e.to_string()))?;

    let ids = tag_ids_for_names(&tx, &preset.tags)?;
    for tag_id in ids {
        tx.execute(
            "INSERT OR IGNORE INTO preset_tags(preset_id, tag_id) VALUES (?1, ?2)",
            params![preset.id, tag_id],
        )
        .map_err(|e| AppError::Io(e.to_string()))?;
    }
    tx.commit().map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_preset(state: State<'_, DbState>, id: String) -> AppResult<()> {
    let conn = state.0.lock().map_err(|e| AppError::Io(e.to_string()))?;
    conn.execute("DELETE FROM presets WHERE id = ?1", params![id])
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn list_tags(state: State<'_, DbState>) -> AppResult<Vec<String>> {
    let conn = state.0.lock().map_err(|e| AppError::Io(e.to_string()))?;
    let mut stmt = conn
        .prepare("SELECT name FROM tags ORDER BY name")
        .map_err(|e| AppError::Io(e.to_string()))?;
    let rows = stmt
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(|e| AppError::Io(e.to_string()))?;
    let mut tags = Vec::new();
    for r in rows {
        tags.push(r.map_err(|e| AppError::Io(e.to_string()))?);
    }
    Ok(tags)
}
