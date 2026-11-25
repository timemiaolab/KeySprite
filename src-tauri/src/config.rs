use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

pub const CONFIG_STORE_FILE: &str = "config.json";
pub const CONFIG_STORE_KEY: &str = "keysprite_config";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MacTerminal {
    Terminal,
    Iterm2,
    Warp,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WinTerminal {
    WindowsTerminal,
    PowerShell,
    Cmd,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LinuxTerminal {
    Auto,
    GnomeTerminal,
    Konsole,
    Alacritty,
    Kitty,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PassthroughStrategy {
    IgnoreNonFileManager,
    SimulateKeyPassthrough,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default = "default_language")]
    pub language: String,
    pub copy_path_shortcut: String,
    pub open_terminal_shortcut: String,
    pub mac_terminal: MacTerminal,
    pub win_terminal: WinTerminal,
    #[serde(default = "default_linux_terminal")]
    pub linux_terminal: LinuxTerminal,
    pub autostart: bool,
    pub show_notifications: bool,
    pub passthrough_strategy: PassthroughStrategy,
}

fn default_language() -> String {
    "zh-CN".to_string()
}

fn default_linux_terminal() -> LinuxTerminal {
    LinuxTerminal::Auto
}

impl Default for AppConfig {
    fn default() -> Self {
        #[cfg(target_os = "macos")]
        let (copy_shortcut, terminal_shortcut) = (
            "Super+9".to_string(),
            "Super+0".to_string(),
        );

        #[cfg(not(target_os = "macos"))]
        let (copy_shortcut, terminal_shortcut) = (
            "Alt+9".to_string(),
            "Alt+0".to_string(),
        );

        Self {
            language: default_language(),
            copy_path_shortcut: copy_shortcut,
            open_terminal_shortcut: terminal_shortcut,
            mac_terminal: MacTerminal::Terminal,
            win_terminal: WinTerminal::WindowsTerminal,
            linux_terminal: LinuxTerminal::Auto,
            autostart: false,
            show_notifications: true,
            passthrough_strategy: PassthroughStrategy::IgnoreNonFileManager,
        }
    }
}

pub fn load_config(app: &AppHandle) -> AppConfig {
    let Ok(store) = app.store(CONFIG_STORE_FILE) else {
        return AppConfig::default();
    };

    if let Some(value) = store.get(CONFIG_STORE_KEY) {
        if let Ok(parsed) = serde_json::from_value::<AppConfig>(value) {
            return parsed;
        }
    }

    let defaults = AppConfig::default();
    let _ = save_config(app, &defaults);
    defaults
}

pub fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let store = app
        .store(CONFIG_STORE_FILE)
        .map_err(|e| format!("无法打开配置存储: {e}"))?;

    let serialized =
        serde_json::to_value(config).map_err(|e| format!("配置序列化失败: {e}"))?;
    store.set(CONFIG_STORE_KEY, serialized);
    store.save().map_err(|e| format!("配置持久化失败: {e}"))?;
    Ok(())
}
