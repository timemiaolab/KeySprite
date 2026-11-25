pub mod config;
pub mod platform;
pub mod shortcuts;
pub mod tray;

use tauri::{AppHandle, Manager, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

use crate::config::{load_config, save_config, AppConfig};
use crate::platform::{
    check_accessibility_permission, current_os_id, open_accessibility_settings,
};
use crate::shortcuts::register_shortcuts;
use crate::tray::{build_tray, refresh_tray_menu};

#[tauri::command]
fn get_platform_os() -> &'static str {
    current_os_id()
}

#[tauri::command]
fn get_config(app: AppHandle) -> AppConfig {
    load_config(&app)
}

#[tauri::command]
fn save_and_reload_config(app: AppHandle, new_config: AppConfig) -> Result<AppConfig, String> {
    register_shortcuts(&app, &new_config)?;
    save_config(&app, &new_config)?;
    let _ = refresh_tray_menu(&app, &new_config);

    let autostart = app.autolaunch();
    if new_config.autostart {
        let _ = autostart.enable();
    } else {
        let _ = autostart.disable();
    }

    Ok(new_config)
}

#[tauri::command]
fn reset_default_config(app: AppHandle) -> Result<AppConfig, String> {
    let current = load_config(&app);
    let mut defaults = AppConfig::default();
    defaults.language = current.language;
    defaults.autostart = current.autostart;
    save_and_reload_config(app, defaults)
}

#[tauri::command]
fn hide_to_tray(app: AppHandle) {
    if let Some(win) = app.get_webview_window("preferences") {
        let _ = win.hide();
    }
}

#[tauri::command]
fn check_permissions() -> bool {
    check_accessibility_permission()
}

#[tauri::command]
fn request_accessibility_settings() -> Result<(), String> {
    open_accessibility_settings().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle();
            let config = load_config(handle);

            build_tray(handle, &config)?;
            register_shortcuts(handle, &config)?;

            // 手动打开时显示设置窗；开机自启 (--minimized) 时直接静默驻留托盘
            let is_minimized = std::env::args().any(|arg| arg == "--minimized");
            if let Some(win) = app.get_webview_window("preferences") {
                if !is_minimized {
                    let _ = win.show();
                    let _ = win.set_focus();
                }

                // 点击关闭按钮时收起到系统托盘而不退出常驻进程
                let win_clone = win.clone();
                win.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win_clone.hide();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_platform_os,
            get_config,
            save_and_reload_config,
            reset_default_config,
            hide_to_tray,
            check_permissions,
            request_accessibility_settings
        ])
        .run(tauri::generate_context!())
        .expect("KeySprite 启动失败");
}
