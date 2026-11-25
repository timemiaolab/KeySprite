use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use std::path::{Path, PathBuf};
use std::process::Command;

use windows::core::{Interface, VARIANT};
use windows::Win32::Foundation::HWND;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, IServiceProvider, CLSCTX_LOCAL_SERVER,
    COINIT_APARTMENTTHREADED,
};
use windows::Win32::UI::Shell::{
    IFolderView, IShellBrowser, IShellItemArray, IShellWindows, IWebBrowserApp,
    SID_STopLevelBrowser, ShellWindows, SHGetKnownFolderPath, FOLDERID_Desktop, KF_FLAG_DEFAULT,
    SVGIO_SELECTION, SIGDN_FILESYSPATH,
};
use windows::Win32::UI::WindowsAndMessaging::{GetClassNameW, GetForegroundWindow};

use crate::config::WinTerminal;
use super::{FileManagerContext, FileManagerItem, PlatformError};

fn get_window_class_name(hwnd: HWND) -> String {
    let mut buf = [0u16; 256];
    let len = unsafe { GetClassNameW(hwnd, &mut buf) };
    if len <= 0 {
        return String::new();
    }
    OsString::from_wide(&buf[..len as usize])
        .to_string_lossy()
        .into_owned()
}

fn is_explorer_or_desktop_class(class_name: &str) -> bool {
    matches!(
        class_name,
        "CabinetWClass" | "ExploreWClass" | "Progman" | "WorkerW"
    )
}

/// 判断前台窗口是否为资源管理器（CabinetWClass）或桌面（Progman / WorkerW）
pub fn is_file_manager_active() -> bool {
    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.0.is_null() {
        return false;
    }
    let class_name = get_window_class_name(hwnd);
    is_explorer_or_desktop_class(&class_name)
}

/// 通过 Win32 API + IShellWindows COM 接口获取资源管理器当前选中项及目录
pub fn get_active_context() -> Result<FileManagerContext, PlatformError> {
    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.0.is_null() {
        return Ok(FileManagerContext {
            is_file_manager: false,
            app_name: "None".to_string(),
            selected_items: Vec::new(),
            current_dir: None,
        });
    }

    let class_name = get_window_class_name(hwnd);
    if !is_explorer_or_desktop_class(&class_name) {
        return Ok(FileManagerContext {
            is_file_manager: false,
            app_name: class_name,
            selected_items: Vec::new(),
            current_dir: None,
        });
    }

    // 若前台为桌面（Progman / WorkerW），返回桌面路径作为当前目录
    if class_name == "Progman" || class_name == "WorkerW" {
        let desktop_dir = get_desktop_path();
        return Ok(FileManagerContext {
            is_file_manager: true,
            app_name: "Desktop".to_string(),
            selected_items: Vec::new(),
            current_dir: desktop_dir,
        });
    }

    unsafe {
        let hr = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let should_uninit = hr.is_ok();

        let result = query_explorer_window(hwnd);

        if should_uninit {
            CoUninitialize();
        }
        result
    }
}

unsafe fn query_explorer_window(target_hwnd: HWND) -> Result<FileManagerContext, PlatformError> {
    let shell_windows: IShellWindows =
        CoCreateInstance(&ShellWindows, None, CLSCTX_LOCAL_SERVER)
            .map_err(|e| PlatformError::SystemCall(format!("ShellWindows 初始化失败: {e}")))?;

    let count = shell_windows
        .Count()
        .map_err(|e| PlatformError::SystemCall(e.to_string()))?;

    for idx in 0..count {
        // windows 0.58: windows::core::VARIANT has private fields.
        // From<i32> builds a VT_I4 variant (lVal = idx), matching the previous manual layout.
        let var = VARIANT::from(idx);

        let Ok(disp) = shell_windows.Item(&var) else {
            continue;
        };
        let Ok(web_browser) = disp.cast::<IWebBrowserApp>() else {
            continue;
        };
        let Ok(win_hwnd) = web_browser.HWND() else {
            continue;
        };

        if win_hwnd.0 != target_hwnd.0 as isize {
            continue;
        }

        let service_provider: IServiceProvider = web_browser
            .cast()
            .map_err(|e| PlatformError::SystemCall(e.to_string()))?;
        let shell_browser: IShellBrowser = service_provider
            .QueryService(&SID_STopLevelBrowser)
            .map_err(|e| PlatformError::SystemCall(e.to_string()))?;
        let shell_view = shell_browser
            .QueryActiveShellView()
            .map_err(|e| PlatformError::SystemCall(e.to_string()))?;
        let folder_view: IFolderView = shell_view
            .cast()
            .map_err(|e| PlatformError::SystemCall(e.to_string()))?;

        let mut selected_items = Vec::new();
        if let Ok(items) = folder_view.Items::<IShellItemArray>(SVGIO_SELECTION) {
            if let Ok(item_count) = items.GetCount() {
                for i in 0..item_count {
                    if let Ok(shell_item) = items.GetItemAt(i) {
                        if let Ok(pwstr) = shell_item.GetDisplayName(SIGDN_FILESYSPATH) {
                            let path_str = pwstr.to_string().unwrap_or_default();
                            if !path_str.is_empty() {
                                let path = PathBuf::from(&path_str);
                                let is_dir = path.is_dir();
                                selected_items.push(FileManagerItem { path, is_dir });
                            }
                        }
                    }
                }
            }
        }

        let current_dir = web_browser.LocationURL().ok().and_then(|url| {
            let url_str = url.to_string();
            url_str
                .strip_prefix("file:///")
                .map(|rest| PathBuf::from(rest.replace('/', "\\")))
        });

        return Ok(FileManagerContext {
            is_file_manager: true,
            app_name: "Explorer".to_string(),
            selected_items,
            current_dir,
        });
    }

    Err(PlatformError::NoActivePath)
}

fn get_desktop_path() -> Option<PathBuf> {
    unsafe {
        SHGetKnownFolderPath(&FOLDERID_Desktop, KF_FLAG_DEFAULT, None)
            .ok()
            .and_then(|pwstr| pwstr.to_string().ok())
            .map(PathBuf::from)
    }
}

/// 优先启动 Windows Terminal (wt.exe)，失败后降级至 PowerShell 或 CMD
pub fn open_terminal_at(dir: &Path, preferred: &WinTerminal) -> Result<(), PlatformError> {
    let dir_str = dir.to_string_lossy().into_owned();

    match preferred {
        WinTerminal::WindowsTerminal => {
            if Command::new("wt").args(["-d", &dir_str]).spawn().is_ok() {
                return Ok(());
            }
            // wt.exe 不存在时自动降级到 PowerShell / CMD
            if Command::new("powershell")
                .args([
                    "-NoExit",
                    "-Command",
                    &format!("Set-Location -LiteralPath '{}'", dir_str.replace('\'', "''")),
                ])
                .spawn()
                .is_ok()
            {
                return Ok(());
            }
            Command::new("cmd")
                .args(["/K", &format!("cd /d \"{}\"", dir_str)])
                .spawn()
                .map_err(|e| PlatformError::TerminalLaunch(e.to_string()))?;
        }
        WinTerminal::PowerShell => {
            Command::new("powershell")
                .args([
                    "-NoExit",
                    "-Command",
                    &format!("Set-Location -LiteralPath '{}'", dir_str.replace('\'', "''")),
                ])
                .spawn()
                .map_err(|e| PlatformError::TerminalLaunch(e.to_string()))?;
        }
        WinTerminal::Cmd => {
            Command::new("cmd")
                .args(["/K", &format!("cd /d \"{}\"", dir_str)])
                .spawn()
                .map_err(|e| PlatformError::TerminalLaunch(e.to_string()))?;
        }
    }

    Ok(())
}
