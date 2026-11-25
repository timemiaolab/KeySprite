import cargoToml from '../../src-tauri/Cargo.toml?raw';
import buildRs from '../../src-tauri/build.rs?raw';
import tauriConf from '../../src-tauri/tauri.conf.json?raw';
import defaultCaps from '../../src-tauri/capabilities/default.json?raw';
import mainRs from '../../src-tauri/src/main.rs?raw';
import libRs from '../../src-tauri/src/lib.rs?raw';
import configRs from '../../src-tauri/src/config.rs?raw';
import trayRs from '../../src-tauri/src/tray.rs?raw';
import shortcutsRs from '../../src-tauri/src/shortcuts.rs?raw';
import platformModRs from '../../src-tauri/src/platform/mod.rs?raw';
import platformMacosRs from '../../src-tauri/src/platform/macos.rs?raw';
import platformWindowsRs from '../../src-tauri/src/platform/windows.rs?raw';
import platformLinuxRs from '../../src-tauri/src/platform/linux.rs?raw';

export interface TauriSourceFile {
  id: string;
  path: string;
  language: 'rust' | 'toml' | 'json';
  summary: string;
  platformTag: '跨平台' | 'macOS' | 'Windows' | 'Linux' | '配置';
  code: string;
}

export const TAURI_SOURCE_FILES: TauriSourceFile[] = [
  {
    id: 'lib',
    path: 'src-tauri/src/lib.rs',
    language: 'rust',
    platformTag: '跨平台',
    summary: '应用入口、5 大 Tauri v2 插件初始化、隐藏 Dock 图标与前端 IPC 命令注册',
    code: libRs,
  },
  {
    id: 'macos',
    path: 'src-tauri/src/platform/macos.rs',
    language: 'rust',
    platformTag: 'macOS',
    summary: 'AppleScript 提取 Finder selection/insertion location、Terminal/iTerm2/Warp 启动、辅助功能权限检测',
    code: platformMacosRs,
  },
  {
    id: 'windows',
    path: 'src-tauri/src/platform/windows.rs',
    language: 'rust',
    platformTag: 'Windows',
    summary: 'Win32 GetForegroundWindow + IShellWindows COM 提取选中项、wt.exe 优先启动与 PowerShell/CMD 降级',
    code: platformWindowsRs,
  },
  {
    id: 'platform-mod',
    path: 'src-tauri/src/platform/mod.rs',
    language: 'rust',
    platformTag: '跨平台',
    summary: '#[cfg(target_os = "...")] 条件编译分发层、多选换行路径拼接与文件/目录智能解析',
    code: platformModRs,
  },
  {
    id: 'shortcuts',
    path: 'src-tauri/src/shortcuts.rs',
    language: 'rust',
    platformTag: '跨平台',
    summary: '全局热键动态注册/注销、前台窗口防冲突检测、剪贴板写入与原生系统通知',
    code: shortcutsRs,
  },
  {
    id: 'tray',
    path: 'src-tauri/src/tray.rs',
    language: 'rust',
    platformTag: '跨平台',
    summary: '常驻托盘图标与 7 项菜单构建（只读热键展示、设置窗口唤起、开机自启勾选同步、退出）',
    code: trayRs,
  },
  {
    id: 'config',
    path: 'src-tauri/src/config.rs',
    language: 'rust',
    platformTag: '跨平台',
    summary: '基于 tauri-plugin-store 的本地 config.json 持久化读写与分平台默认热键配置',
    code: configRs,
  },
  {
    id: 'linux',
    path: 'src-tauri/src/platform/linux.rs',
    language: 'rust',
    platformTag: 'Linux',
    summary: 'Linux 桌面环境扩展预留接口（xdg-terminal-exec / gnome-terminal / konsole）',
    code: platformLinuxRs,
  },
  {
    id: 'cargo',
    path: 'src-tauri/Cargo.toml',
    language: 'toml',
    platformTag: '配置',
    summary: 'Tauri v2 与 5 大官方插件依赖声明、Windows COM 特性开关配置',
    code: cargoToml,
  },
  {
    id: 'tauri-conf',
    path: 'src-tauri/tauri.conf.json',
    language: 'json',
    platformTag: '配置',
    summary: '隐藏任务栏、无主窗口默认启动配置及 macOSPrivateApi 启用',
    code: tauriConf,
  },
  {
    id: 'capabilities',
    path: 'src-tauri/capabilities/default.json',
    language: 'json',
    platformTag: '配置',
    summary: 'Tauri v2 安全权限边界声明（全局快捷键、剪贴板、通知、Store、自启）',
    code: defaultCaps,
  },
  {
    id: 'main',
    path: 'src-tauri/src/main.rs',
    language: 'rust',
    platformTag: '跨平台',
    summary: 'Windows release 模式无控制台窗口入口点',
    code: mainRs,
  },
  {
    id: 'build',
    path: 'src-tauri/build.rs',
    language: 'rust',
    platformTag: '配置',
    summary: 'Tauri 构建脚本',
    code: buildRs,
  },
];
