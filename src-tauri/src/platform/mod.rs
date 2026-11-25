use std::path::{Path, PathBuf};
use thiserror::Error;

use crate::config::AppConfig;

#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "linux")]
pub mod linux;

#[derive(Debug, Error)]
pub enum PlatformError {
    #[error("当前平台不支持此操作")]
    UnsupportedPlatform,
    #[error("未能获取到有效的路径或活动目录")]
    NoActivePath,
    #[error("系统调用失败: {0}")]
    SystemCall(String),
    #[error("终端启动失败: {0}")]
    TerminalLaunch(String),
}

#[derive(Debug, Clone)]
pub struct FileManagerItem {
    pub path: PathBuf,
    pub is_dir: bool,
}

#[derive(Debug, Clone)]
pub struct FileManagerContext {
    pub is_file_manager: bool,
    pub app_name: String,
    pub selected_items: Vec<FileManagerItem>,
    pub current_dir: Option<PathBuf>,
}

/// 返回当前运行操作系统标识 ("macos" | "windows" | "linux")
pub fn current_os_id() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "macos"
    }
    #[cfg(target_os = "windows")]
    {
        "windows"
    }
    #[cfg(target_os = "linux")]
    {
        "linux"
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        "linux"
    }
}

/// 判断当前前台激活的窗口是否为系统文件管理器（Finder / 资源管理器 / Linux 文件管理器 / 桌面）
pub fn is_file_manager_active() -> bool {
    #[cfg(target_os = "macos")]
    {
        macos::is_file_manager_active()
    }
    #[cfg(target_os = "windows")]
    {
        windows::is_file_manager_active()
    }
    #[cfg(target_os = "linux")]
    {
        linux::is_file_manager_active()
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        false
    }
}

/// 获取当前激活文件管理器的选中项与所在目录
pub fn get_active_context() -> Result<FileManagerContext, PlatformError> {
    #[cfg(target_os = "macos")]
    {
        macos::get_active_context()
    }
    #[cfg(target_os = "windows")]
    {
        windows::get_active_context()
    }
    #[cfg(target_os = "linux")]
    {
        linux::get_active_context()
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Err(PlatformError::UnsupportedPlatform)
    }
}

/// 解析用于复制的路径文本：多选按换行符拼接；未选中则使用当前打开目录
pub fn resolve_copy_text(ctx: &FileManagerContext) -> Option<String> {
    if !ctx.selected_items.is_empty() {
        let lines: Vec<String> = ctx
            .selected_items
            .iter()
            .map(|item| item.path.to_string_lossy().into_owned())
            .collect();
        return Some(lines.join("\n"));
    }

    ctx.current_dir
        .as_ref()
        .map(|dir| dir.to_string_lossy().into_owned())
}

/// 智能解析终端目标目录：
/// - 选中文件夹 -> 该文件夹自身
/// - 选中文件 -> 该文件所在父目录
/// - 多选 -> 取第一个选中项所在目录
/// - 未选中 -> 当前打开窗口目录
pub fn resolve_target_dir(ctx: &FileManagerContext) -> Option<PathBuf> {
    if let Some(first) = ctx.selected_items.first() {
        if first.is_dir || first.path.is_dir() {
            return Some(first.path.clone());
        }
        return first
            .path
            .parent()
            .map(|p| p.to_path_buf())
            .or_else(|| ctx.current_dir.clone());
    }

    ctx.current_dir.clone()
}

/// 打开系统终端并自动定位到目标目录
pub fn open_terminal_at(dir: &Path, config: &AppConfig) -> Result<(), PlatformError> {
    #[cfg(target_os = "macos")]
    {
        macos::open_terminal_at(dir, &config.mac_terminal)
    }
    #[cfg(target_os = "windows")]
    {
        windows::open_terminal_at(dir, &config.win_terminal)
    }
    #[cfg(target_os = "linux")]
    {
        linux::open_terminal_at(dir, &config.linux_terminal)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = (dir, config);
        Err(PlatformError::UnsupportedPlatform)
    }
}

/// 检查辅助功能权限（macOS 专用，Windows / Linux 默认返回 true）
pub fn check_accessibility_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        macos::check_accessibility_permission(false)
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

/// 引导打开系统辅助功能授权页面（macOS 专用）
pub fn open_accessibility_settings() -> Result<(), PlatformError> {
    #[cfg(target_os = "macos")]
    {
        macos::open_accessibility_settings()
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}
