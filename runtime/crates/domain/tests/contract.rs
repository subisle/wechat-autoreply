//! 契约测试：06 评审要求的领域规则在 domain 层即生效

use domain::*;

// ---- 作用域（P0-5）----
#[test]
fn private_chat_scopes_exclude_groups() {
    let scopes = Scope::allowed_scopes_for_conversation("wxid_zhangsan");
    assert_eq!(scopes.len(), 2);
    assert!(scopes.iter().any(|s| s.scope_type == ScopeType::Contact));
    assert!(scopes.iter().all(|s| s.scope_type != ScopeType::Group));
}

#[test]
fn group_chat_scopes_exclude_contact_memories() {
    let scopes = Scope::allowed_scopes_for_conversation("12345@chatroom");
    assert!(scopes.iter().any(|s| s.scope_type == ScopeType::Group));
    assert!(scopes.iter().all(|s| s.scope_type != ScopeType::Contact));
}

#[test]
fn contact_scope_more_specific_than_global() {
    assert!(Scope::contact("wxid_a").specificity() < Scope::global().specificity());
}

// ---- 学习信号准入（评审二）----
#[test]
fn ai_auto_outbound_not_eligible_for_learning() {
    let e = Event {
        message_id: None,
        conversation_id: "wxid_a".into(),
        sender_id: "self".into(),
        ingest_source: IngestSource::LiveHook,
        direction: Direction::Outbound,
        author_role: AuthorRole::Me,
        outbound_origin: Some(OutboundOrigin::AiAuto),
        identity_confidence: IdentityConfidence::Verified,
        msg_type: 1,
        content: Some("长回复".into()),
        source_time: 1760329200,
    };
    // AI 自动发送不得作为本人风格样本
    assert!(!e.eligible_for_learning());
}

#[test]
fn manual_outbound_eligible() {
    let e = Event {
        outbound_origin: Some(OutboundOrigin::Manual),
        ..make_outbound()
    };
    assert!(e.eligible_for_learning());
}

#[test]
fn uncertain_identity_not_eligible() {
    let e = Event {
        identity_confidence: IdentityConfidence::Uncertain,
        outbound_origin: Some(OutboundOrigin::Manual),
        ..make_outbound()
    };
    assert!(e.eligible_for_learning() == false || e.direction == Direction::Outbound);
    // 规则核心：uncertain 一律排除
    assert_eq!(e.identity_confidence, IdentityConfidence::Uncertain);
    assert!(!e.eligible_for_learning());
}

#[test]
fn history_import_outbound_treated_unknown_origin() {
    // 历史导入：即便 author_role=me，outbound_origin=unknown → 仅弱观察
    let e = Event {
        ingest_source: IngestSource::HistoryImport,
        direction: Direction::Outbound,
        author_role: AuthorRole::Me,
        outbound_origin: Some(OutboundOrigin::Unknown),
        identity_confidence: IdentityConfidence::Verified,
        ..make_outbound()
    };
    // unknown 允许弱观察（统计），但绝不能是 AiAuto —— 契约上可区分
    assert_eq!(e.outbound_origin, Some(OutboundOrigin::Unknown));
    assert!(e.eligible_for_learning()); // 弱观察允许
}

// ---- 策略发布/回滚（评审四）----
#[test]
fn publish_requires_approver() {
    let head = StrategyHead {
        strategy_key: "style.brevity".into(),
        scope: Scope::global(),
        active_version: Some(1),
        updated_at_ms: 0,
    };
    let v = StrategyVersion {
        id: "sv_1".into(),
        strategy_key: "style.brevity".into(),
        version: 2,
        content_json: "{}".into(),
        scope: Scope::global(),
        approval_status: ApprovalStatus::Approved,
        supersedes_version: None,
        approved_by: None, // 缺审批人
        approved_at_ms: None,
        created_at_ms: 0,
    };
    assert!(validate_publish(&head, &v).is_err());
}

#[test]
fn rollback_creates_new_version_pointing_to_old() {
    let head = StrategyHead {
        strategy_key: "style.brevity".into(),
        scope: Scope::global(),
        active_version: Some(3),
        updated_at_ms: 0,
    };
    let target = StrategyVersion {
        id: "sv_1".into(),
        strategy_key: "style.brevity".into(),
        version: 1,
        content_json: r#"{"rule":"short"}"#.into(),
        scope: Scope::global(),
        approval_status: ApprovalStatus::Superseded,
        supersedes_version: None,
        approved_by: None,
        approved_at_ms: None,
        created_at_ms: 0,
    };
    let rb = make_rollback_version(&head, &target, "user", 1760329200000).unwrap();
    // 回滚不改历史：新版本内容=旧内容，supersedes 指向当前 active
    assert_eq!(rb.content_json, target.content_json);
    assert_eq!(rb.supersedes_version, Some(3));
    assert_eq!(rb.approval_status, ApprovalStatus::Approved);
}

fn make_outbound() -> Event {
    Event {
        message_id: None,
        conversation_id: "wxid_a".into(),
        sender_id: "self".into(),
        ingest_source: IngestSource::LiveHook,
        direction: Direction::Outbound,
        author_role: AuthorRole::Me,
        outbound_origin: Some(OutboundOrigin::Manual),
        identity_confidence: IdentityConfidence::Verified,
        msg_type: 1,
        content: Some("ok".into()),
        source_time: 1760329200,
    }
}
