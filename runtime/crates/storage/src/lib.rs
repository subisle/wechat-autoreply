//! storage — SQLite 仓库层（07 §1.0：唯一业务写入口；业务层拿不到裸 Connection）

pub mod migrations;
pub mod repo;

pub use repo::*;

use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

pub struct Pool {
    conn: Mutex<Connection>,
}

impl Pool {
    /// 打开（或创建）主库并执行迁移
    pub fn open(db_path: &Path) -> Result<Self, StorageError> {
        if let Some(parent) = db_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let conn = Connection::open(db_path)
            .map_err(|e| StorageError::Sqlite(e.to_string()))?;
        conn.pragma_update(None, "journal_mode", "WAL")
            .map_err(|e| StorageError::Sqlite(e.to_string()))?;
        conn.pragma_update(None, "foreign_keys", "ON")
            .map_err(|e| StorageError::Sqlite(e.to_string()))?;
        migrations::run(&conn)?;
        migrations::verify_final_schema(&conn)?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    /// 测试/专用场景：内存库
    pub fn open_in_memory() -> Result<Self, StorageError> {
        let conn = Connection::open_in_memory()
            .map_err(|e| StorageError::Sqlite(e.to_string()))?;
        conn.pragma_update(None, "foreign_keys", "ON")
            .map_err(|e| StorageError::Sqlite(e.to_string()))?;
        migrations::run(&conn)?;
        migrations::verify_final_schema(&conn)?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn with<T>(&self, f: impl FnOnce(&Connection) -> Result<T, StorageError>) -> Result<T, StorageError> {
        let conn = self.conn.lock().expect("storage poisoned");
        f(&conn)
    }

    /// 事务封装：闭包 Err 即回滚（07 §1.1：迁移/业务同规）
    pub fn tx<T>(&self, f: impl FnOnce(&Connection) -> Result<T, StorageError>) -> Result<T, StorageError> {
        let mut conn = self.conn.lock().expect("storage poisoned");
        let tx = conn
            .transaction()
            .map_err(|e| StorageError::Sqlite(e.to_string()))?;
        match f(&tx) {
            Ok(v) => {
                tx.commit().map_err(|e| StorageError::Sqlite(e.to_string()))?;
                Ok(v)
            }
            Err(e) => {
                let _ = tx.rollback();
                Err(e)
            }
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("sqlite: {0}")]
    Sqlite(String),
    #[error("迁移失败: {0}")]
    Migration(String),
    #[error("领域错误: {0}")]
    Domain(#[from] domain::DomainError),
}
