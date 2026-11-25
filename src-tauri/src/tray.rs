use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};
use tauri_plugin_autostart::ManagerExt;

use crate::config::{load_config, save_config, AppConfig};

pub const TRAY_ID: &str = "keysprite-tray";

pub fn build_tray(app: &AppHandle, config: &AppConfig) -> tauri::Result<()> {
    let menu = create_tray_menu(app, config)?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("KeySprite 快捷键精灵");

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open_settings" => {
                if let Some(win) = app.get_webview_window("preferences") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "toggle_autostart" => {
                let mut current = load_config(app);
                let next_state = !current.autostart;
                let autostart = app.autolaunch();
                let res = if next_state {
                    autostart.enable()
                } else {
                    autostart.disable()
                };
                if res.is_ok() {
                    current.autostart = next_state;
                    let _ = save_config(app, &current);
                    let _ = refresh_tray_menu(app, &current);
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

pub fn refresh_tray_menu(app: &AppHandle, config: &AppConfig) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let menu = create_tray_menu(app, config)?;
        tray.set_menu(Some(menu))?;
    }
    Ok(())
}

fn create_tray_menu(app: &AppHandle, config: &AppConfig) -> tauri::Result<Menu<tauri::Wry>> {
    let copy_label = format!("复制路径 ({})", format_display_shortcut(&config.copy_path_shortcut));
    let term_label = format!("打开终端 ({})", format_display_shortcut(&config.open_terminal_shortcut));

    let status_copy = MenuItem::with_id(app, "status_copy", copy_label, false, None::<&str>)?;
    let status_term = MenuItem::with_id(app, "status_term", term_label, false, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let settings_item = MenuItem::with_id(app, "open_settings", "设置 (Settings)", true, None::<&str>)?;
    let autostart_item = CheckMenuItem::with_id(
        app,
        "toggle_autostart",
        "开机自启 (Launch at Startup)",
        true,
        config.autostart,
        None::<&str>,
    )?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出 (Quit KeySprite)", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &status_copy,
            &status_term,
            &sep1,
            &settings_item,
            &autostart_item,
            &sep2,
            &quit_item,
        ],
    )
}

fn format_display_shortcut(raw: &str) -> String {
    raw.replace("Super+", "Cmd+")
        .replace("CommandOrControl+", "Cmd/")
        .replace("Control+", "Ctrl+")
}
