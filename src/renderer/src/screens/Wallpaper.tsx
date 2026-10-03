import { useState } from 'react'
import type { FitMode, WallpaperSource, WallpaperState } from '../../../shared/types'
import { Check, Panel, RainCanvas, TRange } from '../components/ui'

const FITS: { id: FitMode; label: string }[] = [
  { id: 'cover', label: 'lấp đầy' },
  { id: 'contain', label: 'vừa khung' },
  { id: 'fill', label: 'kéo giãn' }
]

const ATTACH: Record<string, string> = {
  'progman-24h2': 'WIN11 24H2+',
  'workerw-legacy': 'WORKERW',
  failed: 'LỖI GẮN DESKTOP'
}

const fileName = (p: string): string => p.split(/[\\/]/).pop() ?? p
const isImage = (p: string): boolean => /\.(jpe?g|png|webp|gif|bmp)$/i.test(p)

function Media({ path, fit, brightness, className = '' }: { path: string; fit: FitMode; brightness: number; className?: string }) {
  const url = window.lounge.mediaUrl(path)
  const style = { objectFit: fit, filter: `brightness(${brightness / 100})` } as const
  return isImage(path) ? (
    <img src={url} className={className} style={style} />
  ) : (
    <video src={url} className={className} style={style} autoPlay loop muted />
  )
}

export function WallpaperScreen({ wallpaper: wp }: { wallpaper: WallpaperState | null }) {
  const [picked, setPicked] = useState<string | null>(null)
  if (!wp) return null

  const previewPath = picked ?? wp.source?.path ?? null
  const isCurrent = !!previewPath && previewPath === wp.source?.path
  const fx = wp.effects

  const pick = async (): Promise<void> => {
    const path = await window.lounge.dialog.pickWallpaper()
    if (path) setPicked(path)
  }

  return (
    <div className="grid grid-cols-12 gap-5 p-5 pt-6">
      <div className="col-span-8 flex min-w-0 flex-col gap-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] text-ph-dim">
              <span className="text-cyan">&gt;</span> wallpaper_engine --live
            </div>
            <h2 className="font-pixel text-[38px] leading-none text-ph-bright rgb-split">HÌNH NỀN ĐỘNG</h2>
          </div>
          <div className="flex gap-2">
            <button className="tbtn" onClick={pick}>
              + chọn file
            </button>
            <button className="tbtn primary" disabled={!previewPath || isCurrent} onClick={() => previewPath && window.lounge.wallpaper.apply(previewPath).then(() => setPicked(null))}>
              {isCurrent ? '✓ đang dùng' : '▶ áp dụng'}
            </button>
          </div>
        </div>

        <Panel title="màn hình xem trước" className="p-3 pt-4">
          <div className="relative aspect-video w-full overflow-hidden border border-crt-line bg-crt-bg">
            {previewPath ? (
              <Media path={previewPath} fit={wp.fit} brightness={fx.brightness} className="absolute inset-0 h-full w-full" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-ph-dim">
                <div className="font-pixel text-[40px] text-ph-faint">NO SIGNAL</div>
                <div className="text-[12px]">chọn ảnh hoặc video mp4 / webm để xem trước</div>
              </div>
            )}
            {previewPath && <RainCanvas density={fx.rain} paused={isCurrent && wp.paused} className="absolute inset-0 h-full w-full" />}
            {previewPath && fx.scanlines && <div className="scanlines absolute inset-0" />}
            <div className="absolute top-2 left-2 flex gap-2">
              {wp.source && (
                <span className={`badge bg-crt-bg/80 ${wp.paused ? '' : 'ok'}`}>
                  <span className="led" />
                  {wp.paused ? 'TẠM DỪNG' : 'LIVE'} · {wp.attachMode ? ATTACH[wp.attachMode] : '...'} · {wp.displays} MÀN HÌNH
                </span>
              )}
              {picked && !isCurrent && <span className="badge live bg-crt-bg/80">CHƯA ÁP DỤNG</span>}
            </div>
            {previewPath && <div className="absolute right-2 bottom-2 left-2 truncate bg-crt-bg/80 px-2 py-1 text-[11px] text-ph-dim">{previewPath}</div>}
          </div>
        </Panel>

        <Panel title="hiệu ứng (vẽ trực tiếp lên desktop)" className="grid grid-cols-3 gap-5 p-4 pt-5">
          <label className="flex flex-col gap-1.5 text-[11px]">
            <span className="flex justify-between text-ph-dim">
              MƯA PIXEL <span className="text-cyan">{fx.rain}%</span>
            </span>
            <TRange label="Mật độ mưa" min={0} max={100} step={1} value={fx.rain} onChange={(v) => window.lounge.wallpaper.setEffects({ rain: v })} />
          </label>
          <label className="flex flex-col gap-1.5 text-[11px]">
            <span className="flex justify-between text-ph-dim">
              ĐỘ SÁNG <span className="text-magenta">{fx.brightness}%</span>
            </span>
            <TRange label="Độ sáng" min={30} max={100} step={1} value={fx.brightness} onChange={(v) => window.lounge.wallpaper.setEffects({ brightness: v })} />
          </label>
          <div className="text-[12px]">
            <Check checked={fx.scanlines} onChange={(v) => window.lounge.wallpaper.setEffects({ scanlines: v })} label="Scanline CRT" />
          </div>
        </Panel>
      </div>

      <div className="col-span-4 flex min-w-0 flex-col gap-5">
        <Panel title="điều khiển" className="flex flex-col gap-4 p-4 pt-5">
          <div>
            <div className="mb-1.5 text-[11px] text-ph-dim">KIỂU HIỂN THỊ</div>
            <div className="flex gap-1">
              {FITS.map((f) => (
                <button key={f.id} className={`tab ${wp.fit === f.id ? 'active' : ''}`} onClick={() => window.lounge.wallpaper.setFit(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <Check checked={wp.autoPause} onChange={(v) => window.lounge.wallpaper.setAutoPause(v)} label="Tự dừng khi chơi game" hint="khi có app/game phủ kín toàn màn hình" />
          <div className="flex gap-2">
            <button className="tbtn flex-1 justify-center" disabled={!wp.source} onClick={() => window.lounge.wallpaper.togglePause()}>
              {wp.paused ? '▶ tiếp tục' : '❚❚ tạm dừng'}
            </button>
            <button className="tbtn danger" disabled={!wp.source} onClick={() => window.lounge.wallpaper.clear()}>
              gỡ
            </button>
          </div>
        </Panel>

        <Panel title={`đã dùng gần đây (${wp.history.length})`} className="flex min-h-0 flex-1 flex-col p-3 pt-4">
          {wp.history.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-ph-dim">&gt; chưa có lịch sử — áp dụng một hình nền để lưu vào đây</div>
          ) : (
            <div className="flex flex-col gap-1 overflow-y-auto">
              {wp.history.map((s: WallpaperSource) => {
                const active = s.path === wp.source?.path
                return (
                  <div
                    key={s.path}
                    className={`group flex cursor-pointer items-center gap-3 p-1.5 ${previewPath === s.path ? 'row-active' : 'row-hover'}`}
                    onClick={() => setPicked(s.path)}
                  >
                    <div className="relative h-12 w-20 shrink-0 overflow-hidden border border-crt-line">
                      {s.kind === 'image' ? (
                        <img src={window.lounge.mediaUrl(s.path)} className="h-full w-full object-cover" />
                      ) : (
                        <video src={`${window.lounge.mediaUrl(s.path)}#t=1`} preload="metadata" muted className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px]">{fileName(s.path)}</div>
                      <div className="text-[10.5px] text-ph-dim">
                        {s.kind.toUpperCase()}
                        {active && <span className="ml-2 text-cyan">● ĐANG DÙNG</span>}
                      </div>
                    </div>
                    <button
                      className="tbtn sm ghost opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.lounge.wallpaper.forget(s.path)
                      }}
                      aria-label="Xóa khỏi lịch sử"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
