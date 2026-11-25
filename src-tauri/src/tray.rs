use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};
use tauri_plugin_autostart::ManagerExt;

use crate::config::{load_config, save_config, AppConfig};

pub const TRAY_ID: &str = "keysprite-tray";

struct TrayLabels {
    copy_path: &'static str,
    open_terminal: &'static str,
    file_hash: &'static str,
    settings: &'static str,
    autostart: &'static str,
    quit: &'static str,
}

fn get_tray_labels(lang: &str) -> TrayLabels {
    match lang {
        "zh-TW" => TrayLabels {
            copy_path: "複製路徑",
            open_terminal: "開啟終端機",
            file_hash: "計算檔案雜湊",
            settings: "設定",
            autostart: "開機自動啟動",
            quit: "結束 KeySprite",
        },
        "en" => TrayLabels {
            copy_path: "Copy Path",
            open_terminal: "Open Terminal",
            file_hash: "File SHA256 & MD5",
            settings: "Settings",
            autostart: "Launch at Startup",
            quit: "Quit KeySprite",
        },
        "ja" => TrayLabels {
            copy_path: "パスをコピー",
            open_terminal: "ターミナルを開く",
            file_hash: "SHA256 / MD5 計算",
            settings: "設定",
            autostart: "ログイン時に起動",
            quit: "KeySprite を終了",
        },
        "ko" => TrayLabels {
            copy_path: "경로 복사",
            open_terminal: "터미널 열기",
            file_hash: "SHA256 / MD5 계산",
            settings: "설정",
            autostart: "시스템 시작 시 자동 실행",
            quit: "KeySprite 종료",
        },
        "es" => TrayLabels {
            copy_path: "Copiar ruta",
            open_terminal: "Abrir terminal",
            file_hash: "Hash SHA256 y MD5",
            settings: "Configuración",
            autostart: "Iniciar con el sistema",
            quit: "Salir de KeySprite",
        },
        "fr" => TrayLabels {
            copy_path: "Copier le chemin",
            open_terminal: "Ouvrir le terminal",
            file_hash: "Empreinte SHA256 & MD5",
            settings: "Paramètres",
            autostart: "Lancer au démarrage",
            quit: "Quitter KeySprite",
        },
        "de" => TrayLabels {
            copy_path: "Pfad kopieren",
            open_terminal: "Terminal öffnen",
            file_hash: "SHA256 & MD5 berechnen",
            settings: "Einstellungen",
            autostart: "Beim Systemstart ausführen",
            quit: "KeySprite beenden",
        },
        "pt" => TrayLabels {
            copy_path: "Copiar caminho",
            open_terminal: "Abrir terminal",
            file_hash: "Hash SHA256 e MD5",
            settings: "Configurações",
            autostart: "Iniciar com o sistema",
            quit: "Sair do KeySprite",
        },
        "ru" => TrayLabels {
            copy_path: "Копировать путь",
            open_terminal: "Открыть терминал",
            file_hash: "SHA256 и MD5 файла",
            settings: "Настройки",
            autostart: "Запуск при входе",
            quit: "Выйти из KeySprite",
        },
        _ => TrayLabels {
            copy_path: "复制路径",
            open_terminal: "打开终端",
            file_hash: "计算文件校验值",
            settings: "设置",
            autostart: "开机自启",
            quit: "退出 KeySprite",
        },
    }
}

pub fn build_tray(app: &AppHandle, config: &AppConfig) -> tauri::Result<()> {
    let menu = create_tray_menu(app, config)?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("KeySprite");

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open_settings" => {
                if let Some(win) = app.get_webview_window("preferences") {
                    let _ = win.show();
                    let _ = win.unminimize();
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
    let labels = get_tray_labels(&config.language);
    let copy_label = format!(
        "{} ({})",
        labels.copy_path,
        format_display_shortcut(&config.copy_path_shortcut)
    );
    let term_label = format!(
        "{} ({})",
        labels.open_terminal,
        format_display_shortcut(&config.open_terminal_shortcut)
    );
    let hash_label = format!(
        "{} ({})",
        labels.file_hash,
        format_display_shortcut(&config.file_hash_shortcut)
    );

    let status_copy = MenuItem::with_id(app, "status_copy", copy_label, false, None::<&str>)?;
    let status_term = MenuItem::with_id(app, "status_term", term_label, false, None::<&str>)?;
    let status_hash = MenuItem::with_id(app, "status_hash", hash_label, false, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let settings_item = MenuItem::with_id(app, "open_settings", labels.settings, true, None::<&str>)?;
    let autostart_item = CheckMenuItem::with_id(
        app,
        "toggle_autostart",
        labels.autostart,
        true,
        config.autostart,
        None::<&str>,
    )?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", labels.quit, true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &status_copy,
            &status_term,
            &status_hash,
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
