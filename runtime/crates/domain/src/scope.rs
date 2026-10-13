//! 作用域（02 §4.1 / 04 §1.3：四作用域，全项目唯一约定）

use serde::{Deserialize, Serialize};

pub const GLOBAL_SCOPE_ID: &str = "";

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScopeType {
    Global,
    Contact,
    Group,
    Business,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Scope {
    pub scope_type: ScopeType,
    pub scope_id: String,
}

impl Scope {
    pub fn global() -> Self {
        Self { scope_type: ScopeType::Global, scope_id: GLOBAL_SCOPE_ID.to_owned() }
    }

    pub fn contact(wxid: impl Into<String>) -> Self {
        Self { scope_type: ScopeType::Contact, scope_id: wxid.into() }
    }

    pub fn group(chatroom_id: impl Into<String>) -> Self {
        Self { scope_type: ScopeType::Group, scope_id: chatroom_id.into() }
    }

    /// 解析优先级：越具体越优先（数值小者胜）
    pub fn specificity(&self) -> u8 {
        match self.scope_type {
            ScopeType::Contact => 0,
            ScopeType::Group => 1,
            ScopeType::Business => 2,
            ScopeType::Global => 3,
        }
    }

    /// 06 §4.2：构造"允许检索的作用域集合"
    /// 私聊 = contact + global（绝不带入联系人所在群的群聊记忆）
    /// 群聊 = group + global（business 须调用方显式确认适用后追加；contact 级一律不入）
    pub fn allowed_scopes_for_conversation(conversation_id: &str) -> Vec<Scope> {
        if conversation_id.ends_with("@chatroom") {
            vec![Scope::group(conversation_id), Scope::global()]
        } else {
            vec![Scope::contact(conversation_id), Scope::global()]
        }
    }
}
