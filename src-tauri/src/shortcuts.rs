use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use std::str::FromStr;
use std::sync::Mutex;

use md5::Md5;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
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
    pub file_hash: ShortcutBindStatus,
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
            file_hash: ShortcutBindStatus {
                registered: false,
                shortcut: config.file_hash_shortcut.clone(),
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
    FileHash,
}

pub fn register_shortcuts(app: &AppHandle, config: &AppConfig) -> Result<(), ShortcutError> {
    // Parse all three shortcuts before touching current registration, so a typo
    // cannot wipe existing bindings.
    let copy_shortcut = Shortcut::from_str(&config.copy_path_shortcut).map_err(|e| {
        let err = ShortcutError::invalid_format(
            "copyPath",
            &config.copy_path_shortcut,
            e.to_string(),
        );
        let mut status = ShortcutRegistrationStatus::from_config(config);
        status.copy_path.error = Some(err.clone());
        store_registration_status(app, status);
        err
    })?;

    let term_shortcut = Shortcut::from_str(&config.open_terminal_shortcut).map_err(|e| {
        let err = ShortcutError::invalid_format(
            "openTerminal",
            &config.open_terminal_shortcut,
            e.to_string(),
        );
        let mut status = ShortcutRegistrationStatus::from_config(config);
        status.open_terminal.error = Some(err.clone());
        store_registration_status(app, status);
        err
    })?;

    let hash_shortcut = Shortcut::from_str(&config.file_hash_shortcut).map_err(|e| {
        let err = ShortcutError::invalid_format(
            "fileHash",
            &config.file_hash_shortcut,
            e.to_string(),
        );
        let mut status = ShortcutRegistrationStatus::from_config(config);
        status.file_hash.error = Some(err.clone());
        store_registration_status(app, status);
        err
    })?;

    let gs = app.global_shortcut();
    if let Err(e) = gs.unregister_all() {
        let err = ShortcutError::unregister_failed(e.to_string());
        let mut status = ShortcutRegistrationStatus::from_config(config);
        status.copy_path.error = Some(err.clone());
        status.open_terminal.error = Some(err.clone());
        status.file_hash.error = Some(err.clone());
        store_registration_status(app, status);
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

    let hash_error = gs
        .on_shortcut(hash_shortcut, move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                handle_shortcut_action(app, SpriteAction::FileHash);
            }
        })
        .err()
        .map(|e| {
            ShortcutError::register_failed("fileHash", &config.file_hash_shortcut, e.to_string())
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
        file_hash: ShortcutBindStatus {
            registered: hash_error.is_none(),
            shortcut: config.file_hash_shortcut.clone(),
            error: hash_error.clone(),
        },
    };
    store_registration_status(app, status);

    if let Some(err) = copy_error.or(term_error).or(hash_error) {
        return Err(err);
    }
    Ok(())
}

pub fn handle_shortcut_action(app: &AppHandle, action: SpriteAction) {
    // 1. 上下文防冲突检测：仅当 Finder / Explorer / Linux 文件管理器 / 桌面 位于前台时执行
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
        SpriteAction::FileHash => {
            // 仅处理实际文件（明确排除文件夹）
            let files: Vec<_> = ctx
                .selected_items
                .into_iter()
                .filter(|item| !item.is_dir && item.path.is_file())
                .map(|item| item.path)
                .collect();

            if files.is_empty() {
                if config.show_notifications {
                    let _ = app
                        .notification()
                        .builder()
                        .title("KeySprite")
                        .body("请先选中文件（不支持计算文件夹）")
                        .show();
                }
                return;
            }

            let app_handle = app.clone();
            let show_notifications = config.show_notifications;
            std::thread::spawn(move || {
                let mut blocks = Vec::with_capacity(files.len());
                for path in &files {
                    match compute_file_sha256_and_md5(path) {
                        Ok((sha256_hex, md5_hex)) => {
                            let file_name = path
                                .file_name()
                                .map(|n| n.to_string_lossy().into_owned())
                                .unwrap_or_else(|| path.to_string_lossy().into_owned());
                            blocks.push(format!(
                                "File: {file_name}\nSHA256: {sha256_hex}\nMD5: {md5_hex}"
                            ));
                        }
                        Err(err) => {
                            if show_notifications {
                                let _ = app_handle
                                    .notification()
                                    .builder()
                                    .title("KeySprite · 计算文件校验值失败")
                                    .body(err)
                                    .show();
                            }
                            return;
                        }
                    }
                }

                let clipboard_text = blocks.join("\n\n");
                if app_handle.clipboard().write_text(clipboard_text.clone()).is_ok()
                    && show_notifications
                {
                    let summary = if files.len() > 1 {
                        format!("已计算 {} 个文件的 SHA256 与 MD5 并复制到剪贴板", files.len())
                    } else {
                        clipboard_text
                    };
                    let _ = app_handle
                        .notification()
                        .builder()
                        .title("KeySprite · 已复制 SHA256 与 MD5")
                        .body(summary)
                        .show();
                }
            });
        }
    }
}

fn compute_file_sha256_and_md5(path: &Path) -> Result<(String, String), String> {
    let file = File::open(path).map_err(|e| format!("无法读取文件 {}: {e}", path.display()))?;
    let mut reader = BufReader::with_capacity(64 * 1024, file);
    let mut sha256 = Sha256::new();
    let mut md5 = Md5::new();
    let mut buffer = [0u8; 64 * 1024];

    loop {
        let bytes_read = reader
            .read(&mut buffer)
            .map_err(|e| format!("读取文件失败: {e}"))?;
        if bytes_read == 0 {
            break;
        }
        sha256.update(&buffer[..bytes_read]);
        md5.update(&buffer[..bytes_read]);
    }

    let sha256_bytes = sha256.finalize();
    let md5_bytes = md5.finalize();
    Ok((to_lower_hex(&sha256_bytes), to_lower_hex(&md5_bytes)))
}

fn to_lower_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0x0f) as usize] as char);
    }
    out
}
