//! domain — 领域模型与 trait（07 §1.0/§2.2：零 IO，可 mock 单测）
//! 所有业务 crate 依赖本 crate；本 crate 不依赖任何本项目 crate，不做任何 IO。

pub mod event;
pub mod scope;
pub mod strategy;

pub use event::*;
pub use scope::*;
pub use strategy::*;

/// 统一业务错误（07 §2.1 错误码语义）
#[derive(Debug, thiserror::Error)]
pub enum DomainError {
    #[error("参数缺失或格式错误: {0}")]
    BadRequest(String),
    #[error("状态冲突: {0}")]
    Conflict(String),
    #[error("业务校验失败: {0}")]
    Unprocessable(String),
    #[error("内部错误: {0}")]
    Internal(String),
}

pub type DomainResult<T> = Result<T, DomainError>;
