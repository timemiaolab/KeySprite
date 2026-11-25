use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::config::LinuxTerminal;
use super::{FileManagerContext, FileManagerItem, PlatformError};

const FILE_MANAGER_CLASSES: &[&str] = &[
    "nautilus",
    "org.gnome.nautilus",
    "dolphin",
    "nemo",
    "thunar",
    "pcmanfm",
    "pcmanfm-qt",
    "caja",
    "dde-file-manager",
    "peony",
    "desktop_window",
    "xfdesktop",
];

fn active_window_id() -> Option<String> {
    if let Ok(out) = Command::new("xdotool").arg("getactivewindow").output() {
        if out.status.success() {
            let id = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !id.is_empty() {
                return Some(id);
            }
        }
    }

    if let Ok(out) = Command::new("xprop")
        .args(["-root", "_NET_ACTIVE_WINDOW"])
        .output()
    {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            if let Some(hex) = text.split_whitespace().last() {
                if hex.starts_with("0x") && hex != "0x0" {
                    return Some(hex.to_string());
                }
            }
        }
    }

    None
}

fn active_window_class(win_id: &str) -> Option<String> {
    if let Ok(out) = Command::new("xdotool")
        .args(["getwindowclassname", win_id])
        .output()
    {
        if out.status.success() {
            let cls = String::from_utf8_lossy(&out.stdout).trim().to_lowercase();
            if !cls.is_empty() {
                return Some(cls);
            }
        }
    }

    if let Ok(out) = Command::new("xprop")
        .args(["-id", win_id, "WM_CLASS"])
        .output()
    {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout).to_lowercase();
            if !text.is_empty() {
                return Some(text);
            }
        }
    }

    None
}

fn active_window_title(win_id: &str) -> Option<String> {
    Command::new("xdotool")
        .args(["getwindowname", win_id])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
}

fn active_window_pid(win_id: &str) -> Option<String> {
    Command::new("xdotool")
        .args(["getwindowpid", win_id])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
}

fn is_known_file_manager_class(class_str: &str) -> bool {
    FILE_MANAGER_CLASSES
        .iter()
        .any(|known| class_str.contains(known))
}

/// 检测 Linux 前台激活窗口是否为桌面环境常见文件管理器或桌面（Nautilus / Dolphin / Nemo / Thunar / XFCE 等）
pub fn is_file_manager_active() -> bool {
    let Some(win_id) = active_window_id() else {
        return false;
    };
    let Some(class_str) = active_window_class(&win_id) else {
        return false;
    };
    is_known_file_manager_class(&class_str)
}

/// 获取 Linux 文件管理器当前目录或选中项（兼容 X11 xdotool / xprop / /proc/<pid>/cwd / xclip）
pub fn get_active_context() -> Result<FileManagerContext, PlatformError> {
    let Some(win_id) = active_window_id() else {
        return Ok(FileManagerContext {
            is_file_manager: false,
            app_name: "Unknown".to_string(),
            selected_items: Vec::new(),
            current_dir: None,
        });
    };

    let class_str = active_window_class(&win_id).unwrap_or_default();
    if !is_known_file_manager_class(&class_str) {
        return Ok(FileManagerContext {
            is_file_manager: false,
            app_name: class_str,
            selected_items: Vec::new(),
            current_dir: None,
        });
    }

    let is_desktop = class_str.contains("desktop_window") || class_str.contains("xfdesktop");
    let mut current_dir: Option<PathBuf> = None;

    if is_desktop {
        current_dir = env::var_os("HOME").map(|h| PathBuf::from(h).join("Desktop"));
    }

    // 尝试从窗口标题解析路径（Dolphin / Thunar 等常在标题包含绝对路径）
    if current_dir.is_none() {
        if let Some(title) = active_window_title(&win_id) {
            let candidate = title.split(" — ").next().unwrap_or(&title).trim();
            if candidate.starts_with('/') && Path::new(candidate).exists() {
                current_dir = Some(PathBuf::from(candidate));
            } else if candidate.starts_with('~') {
                if let Some(home) = env::var_os("HOME") {
                    let expanded = PathBuf::from(home).join(candidate.trim_start_matches("~/"));
                    if expanded.exists() {
                        current_dir = Some(expanded);
                    }
                }
            }
        }
    }

    // 回退到进程工作目录 /proc/<pid>/cwd 或用户主目录
    if current_dir.is_none() {
        if let Some(pid) = active_window_pid(&win_id) {
            if let Ok(cwd) = fs::read_link(format!("/proc/{pid}/cwd")) {
                if cwd.exists() {
                    current_dir = Some(cwd);
                }
            }
        }
    }
    if current_dir.is_none() {
        current_dir = env::var_os("HOME").map(PathBuf::from);
    }

    // 读取 X11 PRIMARY 选区中的文件路径（若用户通过框选/Ctrl+C 选中了文件）
    let mut selected_items = Vec::new();
    if let Ok(out) = Command::new("xclip")
        .args(["-o", "-selection", "primary"])
        .output()
    {
        if out.status.success() {
            let raw = String::from_utf8_lossy(&out.stdout);
            for line in raw.lines() {
                let cleaned = line.trim().strip_prefix("file://").unwrap_or(line.trim());
                if cleaned.starts_with('/') {
                    let path = PathBuf::from(cleaned);
                    if path.exists() {
                        let is_dir = path.is_dir();
                        selected_items.push(FileManagerItem { path, is_dir });
                    }
                }
            }
        }
    }

    Ok(FileManagerContext {
        is_file_manager: true,
        app_name: class_str,
        selected_items,
        current_dir,
    })
}

/// 打开 Linux 桌面终端并自动定位到目标目录
pub fn open_terminal_at(dir: &Path, preferred: &LinuxTerminal) -> Result<(), PlatformError> {
    let dir_str = dir.to_string_lossy().into_owned();

    let candidates: Vec<(&str, Vec<&str>)> = match preferred {
        LinuxTerminal::GnomeTerminal => vec![("gnome-terminal", vec!["--working-directory", &dir_str])],
        LinuxTerminal::Konsole => vec![("konsole", vec!["--workdir", &dir_str])],
        LinuxTerminal::Alacritty => vec![("alacritty", vec!["--working-directory", &dir_str])],
        LinuxTerminal::Kitty => vec![("kitty", vec!["--directory", &dir_str])],
        LinuxTerminal::Auto => vec![
            ("xdg-terminal-exec", vec!["--dir", &dir_str]),
            ("gnome-terminal", vec!["--working-directory", &dir_str]),
            ("konsole", vec!["--workdir", &dir_str]),
            ("xfce4-terminal", vec!["--working-directory", &dir_str]),
            ("alacritty", vec!["--working-directory", &dir_str]),
            ("kitty", vec!["--directory", &dir_str]),
        ],
    };

    for (bin, args) in candidates {
        if Command::new(bin).args(args).spawn().is_ok() {
            return Ok(());
        }
    }

    // 兜底尝试 x-terminal-emulator（Debian/Ubuntu 通用终端链接）
    if Command::new("x-terminal-emulator")
        .current_dir(dir)
        .spawn()
        .is_ok()
    {
        return Ok(());
    }

    Err(PlatformError::TerminalLaunch(
        "未检测到可用终端（请安装 gnome-terminal / konsole / alacritty / kitty）".to_string(),
    ))
}
