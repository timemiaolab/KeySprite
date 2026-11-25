use std::str::FromStr;

use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_notification::NotificationExt;

use crate::config::{load_config, AppConfig};
use crate::platform::{
    get_active_context, is_file_manager_active, open_terminal_at, resolve_copy_text,
    resolve_target_dir,
};

#[derive(Debug, Clone, Copy)]
pub enum SpriteAction {
    CopyPath,
    OpenTerminal,
}

pub fn register_shortcuts(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let gs = app.global_shortcut();
    gs.unregister_all()
        .map_err(|e| format!("注销旧快捷键失败: {e}"))?;

    let copy_shortcut = Shortcut::from_str(&config.copy_path_shortcut)
        .map_err(|e| format!("复制路径快捷键格式无效 ({}): {e}", config.copy_path_shortcut))?;
    let term_shortcut = Shortcut::from_str(&config.open_terminal_shortcut)
        .map_err(|e| format!("打开终端快捷键格式无效 ({}): {e}", config.open_terminal_shortcut))?;

    gs.on_shortcut(copy_shortcut, move |app, _shortcut, event| {
        if event.state() == ShortcutState::Pressed {
            handle_shortcut_action(app, SpriteAction::CopyPath);
        }
    })
    .map_err(|e| format!("注册复制路径快捷键失败: {e}"))?;

    gs.on_shortcut(term_shortcut, move |app, _shortcut, event| {
        if event.state() == ShortcutState::Pressed {
            handle_shortcut_action(app, SpriteAction::OpenTerminal);
        }
    })
    .map_err(|e| format!("注册打开终端快捷键失败: {e}"))?;

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
