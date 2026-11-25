use std::str::FromStr;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_notification::NotificationExt;

use crate::config::{load_config, AppConfig};
use crate::platform::{
    get_active_context, is_file_manager_active, open_terminal_at, resolve_copy_text,
    resolve_target_dir,
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutError {
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shortcut: Option<String>,
    pub message: String,
}

impl ShortcutError {
    pub fn to_ipc_string(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| self.message.clone())
    }

    fn invalid_format(action: &str, shortcut: &str, message: String) -> Self {
        Self {
            code: "invalid_format".to_string(),
            action: Some(action.to_string()),
            shortcut: Some(shortcut.to_string()),
            message,
        }
    }

    fn register_failed(action: &str, shortcut: &str, message: String) -> Self {
        Self {
            code: "register_failed".to_string(),
            action: Some(action.to_string()),
            shortcut: Some(shortcut.to_string()),
            message,
        }
    }

    fn unregister_failed(message: String) -> Self {
        Self {
            code: "unregister_failed".to_string(),
            action: None,
            shortcut: None,
            message,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutBindStatus {
    pub registered: bool,
    pub shortcut: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ShortcutError>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutRegistrationStatus {
    pub copy_path: ShortcutBindStatus,
    pub open_terminal: ShortcutBindStatus,
}

impl ShortcutRegistrationStatus {
    pub fn from_config(config: &AppConfig) -> Self {
        Self {
            copy_path: ShortcutBindStatus {
                registered: false,
                shortcut: config.copy_path_shortcut.clone(),
                error: None,
            },
            open_terminal: ShortcutBindStatus {
                registered: false,
                shortcut: config.open_terminal_shortcut.clone(),
                error: None,
            },
        }
    }
}

pub struct RegistrationCache(pub Mutex<ShortcutRegistrationStatus>);

pub fn current_registration_status(
    app: &AppHandle,
    config: &AppConfig,
) -> ShortcutRegistrationStatus {
    if let Some(cache) = app.try_state::<RegistrationCache>() {
        if let Ok(guard) = cache.0.lock() {
            return guard.clone();
        }
    }
    ShortcutRegistrationStatus::from_config(config)
}

fn store_registration_status(app: &AppHandle, status: ShortcutRegistrationStatus) {
    if let Some(cache) = app.try_state::<RegistrationCache>() {
        if let Ok(mut guard) = cache.0.lock() {
            *guard = status;
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum SpriteAction {
    CopyPath,
    OpenTerminal,
}

pub fn register_shortcuts(app: &AppHandle, config: &AppConfig) -> Result<(), ShortcutError> {
    // Parse both shortcuts before touching the current registration, so a typo
    // cannot wipe the previous bindings.
    let copy_shortcut = Shortcut::from_str(&config.copy_path_shortcut).map_err(|e| {
        let err = ShortcutError::invalid_format(
            "copyPath",
            &config.copy_path_shortcut,
            e.to_string(),
        );
        store_registration_status(
            app,
            ShortcutRegistrationStatus {
                copy_path: ShortcutBindStatus {
                    registered: false,
                    shortcut: config.copy_path_shortcut.clone(),
                    error: Some(err.clone()),
                },
                open_terminal: ShortcutBindStatus {
                    registered: false,
                    shortcut: config.open_terminal_shortcut.clone(),
                    error: None,
                },
            },
        );
        err
    })?;
    let term_shortcut = Shortcut::from_str(&config.open_terminal_shortcut).map_err(|e| {
        let err = ShortcutError::invalid_format(
            "openTerminal",
            &config.open_terminal_shortcut,
            e.to_string(),
        );
        store_registration_status(
            app,
            ShortcutRegistrationStatus {
                copy_path: ShortcutBindStatus {
                    registered: false,
                    shortcut: config.copy_path_shortcut.clone(),
                    error: None,
                },
                open_terminal: ShortcutBindStatus {
                    registered: false,
                    shortcut: config.open_terminal_shortcut.clone(),
                    error: Some(err.clone()),
                },
            },
        );
        err
    })?;

    let gs = app.global_shortcut();
    if let Err(e) = gs.unregister_all() {
        let err = ShortcutError::unregister_failed(e.to_string());
        store_registration_status(
            app,
            ShortcutRegistrationStatus {
                copy_path: ShortcutBindStatus {
                    registered: false,
                    shortcut: config.copy_path_shortcut.clone(),
                    error: Some(err.clone()),
                },
                open_terminal: ShortcutBindStatus {
                    registered: false,
                    shortcut: config.open_terminal_shortcut.clone(),
                    error: Some(err.clone()),
                },
            },
        );
        return Err(err);
    }

    let copy_error = gs
        .on_shortcut(copy_shortcut, move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                handle_shortcut_action(app, SpriteAction::CopyPath);
            }
        })
        .err()
        .map(|e| ShortcutError::register_failed("copyPath", &config.copy_path_shortcut, e.to_string()));

    let term_error = gs
        .on_shortcut(term_shortcut, move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                handle_shortcut_action(app, SpriteAction::OpenTerminal);
            }
        })
        .err()
        .map(|e| {
            ShortcutError::register_failed("openTerminal", &config.open_terminal_shortcut, e.to_string())
        });

    let status = ShortcutRegistrationStatus {
        copy_path: ShortcutBindStatus {
            registered: copy_error.is_none(),
            shortcut: config.copy_path_shortcut.clone(),
            error: copy_error.clone(),
        },
        open_terminal: ShortcutBindStatus {
            registered: term_error.is_none(),
            shortcut: config.open_terminal_shortcut.clone(),
            error: term_error.clone(),
        },
    };
    store_registration_status(app, status);

    if let Some(err) = copy_error.or(term_error) {
        return Err(err);
    }
    Ok(())
}

pub fn handle_shortcut_action(app: &AppHandle, action: SpriteAction) {
    // 1. 上下文防冲突检测：仅当 Finder / Explorer / 桌面 位于前台时执行
    if !is_file_manager_active() {
        return;
    }

    let config = load_config(app);
    let Ok(ctx) = get_active_context() else {
        return;
    };

    if !ctx.is_file_manager {
        return;
    }

    match action {
        SpriteAction::CopyPath => {
            if let Some(text) = resolve_copy_text(&ctx) {
                if app.clipboard().write_text(text.clone()).is_ok() && config.show_notifications {
                    let count = ctx.selected_items.len();
                    let body = if count > 1 {
                        format!("已复制 {} 个选中项路径到剪贴板", count)
                    } else {
                        format!("已复制路径: {}", text)
                    };
                    let _ = app
                        .notification()
                        .builder()
                        .title("KeySprite · 已复制路径")
                        .body(body)
                        .show();
                }
            }
        }
        SpriteAction::OpenTerminal => {
            if let Some(target_dir) = resolve_target_dir(&ctx) {
                if let Err(err) = open_terminal_at(&target_dir, &config) {
                    if config.show_notifications {
                        let _ = app
                            .notification()
                            .builder()
                            .title("KeySprite · 终端启动失败")
                            .body(err.to_string())
                            .show();
                    }
                }
            }
        }
    }
}
