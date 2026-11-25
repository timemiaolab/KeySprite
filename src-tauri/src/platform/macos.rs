use std::ffi::c_void;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::config::MacTerminal;
use super::{FileManagerContext, FileManagerItem, PlatformError};

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
}

/// 检测当前前台应用是否为 Finder（包含桌面视图）
pub fn is_file_manager_active() -> bool {
    let script = r#"
        tell application "System Events"
            set frontApp to name of first application process whose frontmost is true
        end tell
        return frontApp
    "#;

    let Ok(output) = Command::new("osascript").args(["-e", script]).output() else {
        return false;
    };

    if !output.status.success() {
        return false;
    }

    let app_name = String::from_utf8_lossy(&output.stdout).trim().to_string();
    app_name == "Finder"
}

/// 获取 Finder 当前选中文件/文件夹列表或当前窗口所在目录
pub fn get_active_context() -> Result<FileManagerContext, PlatformError> {
    if !is_file_manager_active() {
        return Ok(FileManagerContext {
            is_file_manager: false,
            app_name: "Other".to_string(),
            selected_items: Vec::new(),
            current_dir: None,
        });
    }

    // 使用 AppleScript 提取 Finder selection；若无选中项则读取 insertion location（包含桌面）
    let script = r#"
        tell application "Finder"
            set selectedList to selection
            if (count of selectedList) > 0 then
                set outputLines to {}
                repeat with itemRef in selectedList
                    set itemPath to POSIX path of (itemRef as alias)
                    set end of outputLines to "ITEM:" & itemPath
                end repeat
                set AppleScript's text item delimiters to linefeed
                return outputLines as text
            else
                try
                    set currentFolder to POSIX path of (insertion location as alias)
                    return "DIR:" & currentFolder
                on error
                    set desktopFolder to POSIX path of (path to desktop folder as alias)
                    return "DIR:" & desktopFolder
                end try
            end if
        end tell
    "#;

    let output = Command::new("osascript")
        .args(["-e", script])
        .output()
        .map_err(|e| PlatformError::SystemCall(e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(PlatformError::SystemCall(stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut selected_items = Vec::new();
    let mut current_dir = None;

    for raw_line in stdout.lines() {
        let line = raw_line.trim();
        if let Some(path_str) = line.strip_prefix("ITEM:") {
            let trimmed = normalize_posix_path(path_str);
            let path = PathBuf::from(&trimmed);
            let is_dir = path.is_dir();
            selected_items.push(FileManagerItem { path, is_dir });
        } else if let Some(dir_str) = line.strip_prefix("DIR:") {
            let trimmed = normalize_posix_path(dir_str);
            current_dir = Some(PathBuf::from(&trimmed));
        }
    }

    Ok(FileManagerContext {
        is_file_manager: true,
        app_name: "Finder".to_string(),
        selected_items,
        current_dir,
    })
}

fn normalize_posix_path(raw: &str) -> String {
    if raw.len() > 1 && raw.ends_with('/') {
        raw.trim_end_matches('/').to_string()
    } else {
        raw.to_string()
    }
}

/// 打开 macOS 终端应用并定位到目标目录（默认 Terminal.app，预留 iTerm2 / Warp 支持）
pub fn open_terminal_at(dir: &Path, preferred: &MacTerminal) -> Result<(), PlatformError> {
    let dir_str = dir.to_string_lossy();
    let escaped = dir_str.replace('\\', "\\\\").replace('"', "\\\"");

    match preferred {
        MacTerminal::Terminal => {
            let status = Command::new("open")
                .args(["-a", "Terminal", &dir_str])
                .status()
                .map_err(|e| PlatformError::TerminalLaunch(e.to_string()))?;

            if !status.success() {
                let script = format!(
                    "tell application \"Terminal\"\nactivate\ndo script \"cd \\\"{}\\\"\"\nend tell",
                    escaped
                );
                Command::new("osascript")
                    .args(["-e", &script])
                    .status()
                    .map_err(|e| PlatformError::TerminalLaunch(e.to_string()))?;
            }
        }
        MacTerminal::Iterm2 => {
            let script = format!(
                "tell application \"iTerm\"\nactivate\ncreate window with default profile\ntell current session of current window to write text \"cd \\\"{}\\\"\"\nend tell",
                escaped
            );
            Command::new("osascript")
                .args(["-e", &script])
                .status()
                .map_err(|e| PlatformError::TerminalLaunch(e.to_string()))?;
        }
        MacTerminal::Warp => {
            Command::new("open")
                .args(["-a", "Warp", &dir_str])
                .status()
                .map_err(|e| PlatformError::TerminalLaunch(e.to_string()))?;
        }
    }

    Ok(())
}

/// 检测是否已授权 macOS 辅助功能权限
pub fn check_accessibility_permission(_prompt: bool) -> bool {
    let _unused: *const c_void = std::ptr::null();
    unsafe { AXIsProcessTrusted() }
}

/// 引导用户跳转至 系统设置 -> 隐私与安全性 -> 辅助功能
pub fn open_accessibility_settings() -> Result<(), PlatformError> {
    Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .status()
        .map_err(|e| PlatformError::SystemCall(e.to_string()))?;
    Ok(())
}
