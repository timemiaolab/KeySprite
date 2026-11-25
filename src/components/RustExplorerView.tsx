import { useMemo, useState } from 'react';
import { Check, Copy, Download, FileCode2 } from 'lucide-react';
import { TAURI_SOURCE_FILES, TauriSourceFile } from '../data/tauriFiles';

interface RustExplorerViewProps {
  onDownloadBundle: () => void;
}

type FilterCategory = '全部' | '跨平台' | 'macOS' | 'Windows' | 'Linux' | '配置';

export function RustExplorerView({ onDownloadBundle }: RustExplorerViewProps) {
  const [filter, setFilter] = useState<FilterCategory>('全部');
  const [activeFileId, setActiveFileId] = useState<string>('macos');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredFiles = useMemo(() => {
    if (filter === '全部') return TAURI_SOURCE_FILES;
    return TAURI_SOURCE_FILES.filter((f) => f.platformTag === filter);
  }, [filter]);

  const activeFile: TauriSourceFile =
    filteredFiles.find((f) => f.id === activeFileId) ??
    filteredFiles[0] ??
    TAURI_SOURCE_FILES[0];

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.code);
      setCopiedId(activeFile.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore clipboard error if blocked
    }
  };

  const lines = useMemo(() => activeFile.code.split('\n'), [activeFile.code]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A]">
              Tauri v2 + Rust 跨平台客户端源码（macOS / Windows / Linux）
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              启动即默认注册两项全局快捷键，严格按 #[cfg(target_os = &quot;...&quot;)] 分发三大桌面平台实现。
            </p>
          </div>
          <button
            type="button"
            onClick={onDownloadBundle}
            className="px-4 py-2 rounded-lg bg-[#00845A] hover:bg-[#006e4b] text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出跨平台打包工程 (.zip)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
          {[
            {
              step: '01. 托盘与隐身常驻',
              desc: 'ActivationPolicy::Accessory 隐藏 Dock 图标，构建 7 项 Tray 菜单与 skipTaskbar。',
            },
            {
              step: '02. 三平台文件上下文',
              desc: 'macOS AppleScript、Windows Win32+COM、Linux xdotool/xprop 识别文件管理器。',
            },
            {
              step: '03. 开箱即用默认热键',
              desc: '首次运行自动配置 Cmd+9/0 (macOS) 与 Alt+9/0 (Win/Linux) 并写入 config.json。',
            },
            {
              step: '04. 三端 CI 打包配置',
              desc: '导出的压缩包内含 GitHub Actions 构建脚本，可直接输出 .dmg / .exe / .AppImage。',
            },
          ].map((item) => (
            <div key={item.step} className="space-y-1">
              <div className="text-xs font-semibold text-[#12273D]">{item.step}</div>
              <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-slate-50/70">
            <div className="flex flex-wrap items-center gap-1">
              {(
                ['全部', '跨平台', 'macOS', 'Windows', 'Linux', '配置'] as FilterCategory[]
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilter(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    filter === cat
                      ? 'bg-[#12273D] text-white'
                      : 'text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
            {filteredFiles.map((file) => {
              const isActive = file.id === activeFile.id;
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setActiveFileId(file.id)}
                  className={`w-full px-4 py-3 text-left transition-colors cursor-pointer ${
                    isActive ? 'bg-[#12273D]/[0.04]' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isActive ? 'text-[#00845A]' : 'text-slate-400'
                        }`}
                      />
                      <span
                        className={`font-mono text-xs truncate ${
                          isActive ? 'font-semibold text-[#12273D]' : 'text-slate-700'
                        }`}
                      >
                        {file.path}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {file.platformTag}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 line-clamp-1 pl-5">
                    {file.summary}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-8 bg-[#0F172A] text-slate-100 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-[#12273D] border-b border-slate-700/80 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-mono text-xs font-semibold text-white truncate">
                {activeFile.path}
              </div>
              <div className="text-[11px] text-slate-300 truncate mt-0.5">
                {activeFile.summary}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedId === activeFile.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>已复制源码</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>复制文件</span>
                </>
              )}
            </button>
          </div>

          <div className="max-h-[540px] overflow-auto p-4 font-mono text-xs leading-relaxed">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.03]">
                    <td className="select-none pr-4 text-right text-slate-500 w-10 align-top tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="whitespace-pre text-slate-200">{line || ' '}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
