//! 版本化迁移（07 §1.1：PRAGMA user_version + 连续版本 + 幂等）

use rusqlite::Connection;

use crate::StorageError;

/// 内嵌迁移（版本号, 文件名, SQL）
const MIGRATIONS: &[(i64, &str, &str)] = &[
    (1, "V1__core.sql", include_str!("../migrations/V1__core.sql")),
    (2, "V2__learning.sql", include_str!("../migrations/V2__learning.sql")),
    (3, "V3__memory.sql", include_str!("../migrations/V3__memory.sql")),
    (4, "V4__knowledge.sql", include_str!("../migrations/V4__knowledge.sql")),
];

pub fn run(conn: &Connection) -> Result<(), StorageError> {
    let current: i64 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .map_err(|e| StorageError::Sqlite(e.to_string()))?;

    for (version, filename, sql) in MIGRATIONS {
        if *version <= current {
            continue;
        }
        conn.execute_batch(sql)
            .map_err(|e| StorageError::Migration(format!("{filename}: {e}")))?;
        conn.execute_batch(&format!(
            "INSERT INTO schema_history(version, filename, applied_at) VALUES ({version}, '{filename}', strftime('%s','now'));"
        ))
        .map_err(|e| StorageError::Migration(format!("记录 schema_history 失败: {e}")))?;
        conn.pragma_update(None, "user_version", version)
            .map_err(|e| StorageError::Migration(format!("推进 user_version 失败: {e}")))?;
        tracing::info!(version, file = filename, "migration applied");
    }
    Ok(())
}
