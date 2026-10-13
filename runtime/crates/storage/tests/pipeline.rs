//! M9 契约验收：V-03 任务恢复 / V-04 幂等处理（06 评审七）

use storage::{Pool, NewEvent, OutboxJob};

fn ev(msg_id: Option<&str>, source_time: i64) -> NewEvent {
    NewEvent {
        message_id: msg_id.map(String::from),
        conversation_id: "wxid_a".into(),
        sender_id: "wxid_a".into(),
        ingest_source: "live_hook".into(),
        direction: "inbound".into(),
        author_role: "contact".into(),
        outbound_origin: None,
        identity_confidence: "verified".into(),
        msg_type: 1,
        content: Some("你好".into()),
        source_time,
        history_local_id: None,
    }
}

fn jobs_for(key: &str) -> Vec<OutboxJob> {
    vec![OutboxJob {
        job_id: format!("job_{key}"),
        job_type: "memory_extract".into(),
        aggregate_id: Some(key.into()),
        idempotency_key: format!("mem:{key}"),
        priority: 100,
    }]
}

// V-04: 同一消息重复导入 → 不重复入库、不重复登记任务
#[test]
fn duplicate_import_creates_no_duplicate_jobs() {
    let pool = Pool::open_in_memory().unwrap();
    let e = ev(Some("srv_1"), 1760329200);
    let jobs = jobs_for("srv_1");

    let first = pool.tx(|tx| storage::record_event_with_jobs(tx, &e, &jobs, None)).unwrap();
    let second = pool.tx(|tx| storage::record_event_with_jobs(tx, &e, &jobs, None)).unwrap();

    assert!(first, "首次应插入");
    assert!(!second, "重复插入应被幂等拦截");
    pool.with(|c| {
        let n: i64 = c.query_row("SELECT COUNT(*) FROM events", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 1, "events 去重");
        let m: i64 = c.query_row("SELECT COUNT(*) FROM outbox_jobs", [], |r| r.get(0)).unwrap();
        assert_eq!(m, 1, "outbox 不重复登记");
        Ok(())
    }).unwrap();
}

// V-03: 入库后/提取前崩溃 → 重启后任务仍在，可继续领取
#[test]
fn crash_after_insert_job_still_claimable() {
    let pool = Pool::open_in_memory().unwrap();
    pool.tx(|tx| storage::record_event_with_jobs(tx, &ev(Some("srv_2"), 1760329201), &jobs_for("srv_2"), None)).unwrap();
    // 模拟崩溃重启：新连接（同库在内存场景下用同 pool 领取即可）
    let claimed = pool.tx(|tx| storage::claim_next_job(tx)).unwrap();
    assert!(claimed.is_some(), "崩溃后任务必须仍可领取");
    let (job_id, _, _, idem) = claimed.unwrap();
    pool.tx(|tx| storage::complete_job(tx, &job_id)).unwrap();
    assert_eq!(idem, "mem:srv_2");
    // 完成后不再领取
    let again = pool.tx(|tx| storage::claim_next_job(tx)).unwrap();
    assert!(again.is_none());
}

// 同事务：游标推进与入库原子（06 §6.0）
#[test]
fn event_and_cursor_in_same_tx() {
    let pool = Pool::open_in_memory().unwrap();
    let e = ev(Some("srv_3"), 1760329202);
    let cursor = r#"{"last_create_time":1760329202,"last_sort_seq":10,"last_local_id":5}"#;
    pool.tx(|tx| storage::record_event_with_jobs(tx, &e, &[], Some(("wxid_a", cursor)))).unwrap();
    pool.with(|c| {
        let cur: String = c.query_row("SELECT cursor_json FROM import_state WHERE conversation='wxid_a'", [], |r| r.get(0)).unwrap();
        assert!(cur.contains("1760329202"));
        Ok(())
    }).unwrap();
}

// 事务回滚：Err 时 events 不落库（07 §1.1）
#[test]
fn tx_rollback_on_error() {
    let pool = Pool::open_in_memory().unwrap();
    let r: Result<(), storage::StorageError> = pool.tx(|tx| {
        storage::record_event_with_jobs(tx, &ev(Some("srv_4"), 1760329203), &[], None)?;
        Err(storage::StorageError::Sqlite("模拟故障".into()))
    });
    assert!(r.is_err());
    pool.with(|c| {
        let n: i64 = c.query_row("SELECT COUNT(*) FROM events", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 0, "回滚后不得残留");
        Ok(())
    }).unwrap();
}

// 迁移幂等：重复 run 不报错（07 §1.1）
#[test]
fn migrations_idempotent() {
    let pool = Pool::open_in_memory().unwrap();
    pool.with(|c| storage::migrations::run(c)).unwrap(); // 再跑一次：应全部跳过
}
