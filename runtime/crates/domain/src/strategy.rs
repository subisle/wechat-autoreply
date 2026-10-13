//! 策略版本模型（07 §1.3：strategy_versions 历史 + strategy_heads 活动指针）

use serde::{Deserialize, Serialize};

use crate::{DomainError, DomainResult, Scope, ScopeType};

/// 策略审批状态（05 §11.2 八态的存储枚举）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalStatus {
    Draft,
    PendingReview,
    Approved,
    Rejected,
    Superseded,
    RolledBack,
    Archived,
}

/// 一个策略版本（不可变历史；活动指针在 strategy_heads）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyVersion {
    pub id: String,
    pub strategy_key: String,
    pub version: i64,
    pub content_json: String,
    pub scope: Scope,
    pub approval_status: ApprovalStatus,
    /// 回滚/替代来源（回滚=创建指向旧内容的新版本，不改写历史）
    pub supersedes_version: Option<i64>,
    pub approved_by: Option<String>,
    pub approved_at_ms: Option<i64>,
    pub created_at_ms: i64,
}

/// 活动版本指针（UI/学习接口都不得绕过发布服务直接改此表）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyHead {
    pub strategy_key: String,
    pub scope: Scope,
    pub active_version: Option<i64>,
    pub updated_at_ms: i64,
}

/// 发布校验（评审四：同一 strategy_key+scope 只允许一个 active）
pub fn validate_publish(
    head: &StrategyHead,
    new_version: &StrategyVersion,
) -> DomainResult<()> {
    if new_version.strategy_key != head.strategy_key {
        return Err(DomainError::Unprocessable(format!(
            "strategy_key 不匹配: head={} version={}",
            head.strategy_key, new_version.strategy_key
        )));
    }
    if head.scope != new_version.scope {
        return Err(DomainError::Unprocessable("scope 不匹配".into()));
    }
    if matches!(new_version.approval_status, ApprovalStatus::Approved)
        && new_version.approved_by.is_none()
    {
        return Err(DomainError::Unprocessable("APPROVED 必须有 approved_by".into()));
    }
    Ok(())
}

/// 回滚 = 创建指向旧内容的新版本（不改写历史，评审四）
pub fn make_rollback_version(
    head: &StrategyHead,
    target: &StrategyVersion,
    operator: &str,
    now_ms: i64,
) -> DomainResult<StrategyVersion> {
    if head.scope != target.scope {
        return Err(DomainError::BadRequest("回滚目标 scope 不匹配".into()));
    }
    let _ = head.scope_type_check()?;
    Ok(StrategyVersion {
        id: format!("sv_{}_{}", target.strategy_key, now_ms),
        strategy_key: target.strategy_key.clone(),
        version: target.version + 1, // 调用方需以 head 最新版本号为准再覆盖
        content_json: target.content_json.clone(),
        scope: target.scope.clone(),
        approval_status: ApprovalStatus::Approved,
        supersedes_version: head.active_version,
        approved_by: Some(operator.to_owned()),
        approved_at_ms: Some(now_ms),
        created_at_ms: now_ms,
    })
}

impl StrategyHead {
    fn scope_type_check(&self) -> DomainResult<()> {
        if matches!(self.scope.scope_type, ScopeType::Global)
            && !self.scope.scope_id.is_empty()
        {
            return Err(DomainError::Unprocessable("global 作用域 scope_id 必须为空".into()));
        }
        Ok(())
    }
}
