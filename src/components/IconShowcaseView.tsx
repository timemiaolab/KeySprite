import { useState } from 'react';
import { Download } from 'lucide-react';
import {
  KeySpriteAppIcon,
  KeySpriteTraySvg,
  ORIGINAL_LOGO_URL,
  TRAY_TEMPLATE_SVG,
} from './AppLogo';

export function IconShowcaseView() {
  const [origError, setOrigError] = useState(false);

  const handleDownloadTraySvg = () => {
    const blob = new Blob([TRAY_TEMPLATE_SVG], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'keysprite-tray-template.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Side-by-side Brand Reference vs Optimized Squircle App Icon */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A]">原始上传参考图</h2>
            <p className="text-xs text-slate-500 mt-1">
              保留深海蓝 (#12273D) 与翡翠绿 (#00845A) 品牌双色基因，适合作为品牌视觉主色标。
            </p>
          </div>
          <div className="h-56 rounded-lg border border-slate-200 bg-white flex items-center justify-center p-6">
            {origError ? (
              <div className="text-center">
                <div className="text-3xl font-bold text-[#12273D] leading-none">Key</div>
                <div className="text-3xl font-bold text-[#00845A] leading-none">Sprite</div>
              </div>
            ) : (
              <img
                src={ORIGINAL_LOGO_URL}
                alt="用户上传的 KeySprite 原始品牌字标"
                referrerPolicy="no-referrer"
                onError={() => setOrigError(true)}
                className="max-h-full max-w-full object-contain"
              />
            )}
          </div>
          <div className="text-xs text-slate-500">
            字标在 16px / 32px 系统托盘与 Dock 图标尺寸下笔画较密，适合升级为独立几何图形徽标。
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A]">
                优化版桌面应用图标 (macOS / Windows)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                采用深海蓝哑光圆角矩形底座，融合键帽结构、路径斜杠 / 与终端提示符 &gt;，兼顾高辨识度与极小尺寸清晰度。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center pt-2">
            <div className="h-56 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
              <KeySpriteAppIcon size={156} />
            </div>

            <div className="space-y-4">
              <div className="text-xs font-semibold text-[#12273D]">多尺寸渲染检验</div>
              <div className="flex items-end gap-5">
                <div className="text-center space-y-1.5">
                  <KeySpriteAppIcon size={64} />
                  <div className="font-mono text-[11px] text-slate-500">64px</div>
                </div>
                <div className="text-center space-y-1.5">
                  <KeySpriteAppIcon size={40} />
                  <div className="font-mono text-[11px] text-slate-500">40px</div>
                </div>
                <div className="text-center space-y-1.5">
                  <KeySpriteAppIcon size={24} />
                  <div className="font-mono text-[11px] text-slate-500">24px</div>
                </div>
                <div className="text-center space-y-1.5">
                  <KeySpriteAppIcon size={16} />
                  <div className="font-mono text-[11px] text-slate-500">16px</div>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                可直接用于 Tauri <span className="font-mono text-[#12273D]">cargo tauri icon</span>{' '}
                自动生成 <span className="font-mono">.icns</span> 与{' '}
                <span className="font-mono">.ico</span> 安装包图标。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Monochrome Tray Icons for macOS Menu Bar & Windows Taskbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A]">
              系统托盘单色模板图标 (Tray Template SVG)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              遵循 macOS 菜单栏 Template Image 规范及 Windows 11 浅/深色任务栏自动反色要求。
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTraySvg}
            className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-[#12273D] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>下载 tray-template.svg</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5">
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-[#0F172A]">macOS 浅色菜单栏效果</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                单色纯黑矢量 · 18×18pt 居中对齐
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-md bg-white border border-slate-200 text-slate-900 flex items-center gap-2.5">
              <KeySpriteTraySvg size={16} />
              <span className="font-mono text-[11px]">18:08</span>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-slate-800 bg-[#0F172A] flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white">Windows 深色任务栏效果</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                单色纯白矢量 · 高 DPI 锐利描边
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-white flex items-center gap-2.5">
              <KeySpriteTraySvg size={16} />
              <span className="font-mono text-[11px]">18:08</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
