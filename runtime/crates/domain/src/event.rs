//! 事件模型（07 §1.2：五维来源标注 + 双时间戳，06 评审 P0-2/P0-6）

use serde::{Deserialize, Serialize};

/// 消息如何进入系统
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IngestSource {
    LiveHook,
    HistoryImport,
}

/// 收到还是发出
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    Inbound,
    Outbound,
}

/// 消息属于谁
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthorRole {
    Me,
    Contact,
    System,
    Unknown,
}

/// 本人发出的消息如何产生（仅 outbound 有值）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OutboundOrigin {
    Manual,
    AiSuggestion,
    AiAuto,
    Unknown,
}

/// 发送者判定可靠性（uncertain 不参与学习，05 §7.1）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IdentityConfidence {
    Verified,
    Uncertain,
}

/// 一条消息事件（落库前的领域形态；存储细节归 storage）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub message_id: Option<String>,
    pub conversation_id: String,
    pub sender_id: String,
    pub ingest_source: IngestSource,
    pub direction: Direction,
    pub author_role: AuthorRole,
    pub outbound_origin: Option<OutboundOrigin>,
    pub identity_confidence: IdentityConfidence,
    pub msg_type: i64,
    pub content: Option<String>,
    /// 源系统时间原值（微信=unix 秒），排序/游标/过期统一用它
    pub source_time: i64,
}

impl Event {
    /// 学习信号准入（06 §5.1 禁止行为列 + 05 §7.1）
    /// 返回 true = 此事件可作为学习信号候选
    pub fn eligible_for_learning(&self) -> bool {
        if self.identity_confidence != IdentityConfidence::Verified {
            return false; // 来源不确定 → 不作强学习证据
        }
        match self.direction {
            Direction::Inbound => true, // 对方消息：对话上下文可用
            Direction::Outbound => match self.author_role {
                AuthorRole::Me => matches!(
                    self.outbound_origin,
                    Some(OutboundOrigin::Manual) | Some(OutboundOrigin::Unknown)
                ),
                // AI 产生的消息不作本人风格样本（评审二）
                _ => false,
            },
        }
    }
}
