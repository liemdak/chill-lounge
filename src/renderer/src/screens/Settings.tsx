import type { WallpaperState } from '../../../shared/types'
import { Check, Panel, TRange } from '../components/ui'

export interface UiPrefs {
  crt: number
  boot: boolean
}

const KEYS: [string, string][] = [
  ['Space', 'Phát / tạm dừng'],
  ['J / L', 'Bài trước / bài tiếp'],
  ['M', 'Tắt tiếng'],
  ['F', 'Chế độ wallpaper toàn màn hình'],
  ['F1 – F7', 'Chuyển màn hình'],
  ['Esc', 'Đóng hộp thoại']
]

export function SettingsScreen({ prefs, onPrefs, wallpaper }: { prefs: UiPrefs; onPrefs: (p: UiPrefs) => void; wallpaper: WallpaperState | null }) {
  return (
    <div className="flex flex-col gap-5 p-5 pt-6">
      <div>
        <div className="text-[11px] text-ph-dim">
          <span className="text-cyan">&gt;</span> config --edit
        </div>
        <h2 className="font-pixel text-[38px] leading-none text-ph-bright rgb-split">CÀI ĐẶT</h2>
      </div>

      <div className="grid max-w-[1100px] grid-cols-2 gap-5">
        <Panel title="màn hình crt" className="flex flex-col gap-3 p-4 pt-5">
          <label className="flex flex-col gap-1.5 text-[12px]">
            <span className="flex justify-between text-ph-dim">
              CƯỜNG ĐỘ SCANLINE <span className="text-cyan">{Math.round(prefs.crt * 100)}%</span>
            </span>
            <TRange label="Cường độ scanline" min={0} max={1} step={0.05} value={prefs.crt} onChange={(v) => onPrefs({ ...prefs, crt: v })} />
          </label>
          <Check checked={prefs.boot} onChange={(v) => onPrefs({ ...prefs, boot: v })} label="Hiệu ứng khởi động" hint="dòng boot log khi mở app" />
        </Panel>

        <Panel title="wallpaper" className="flex flex-col gap-2 p-4 pt-5">
          <Check
            checked={wallpaper?.autoPause ?? true}
            onChange={(v) => window.lounge.wallpaper.setAutoPause(v)}
            label="Tự dừng khi chơi game / app toàn màn hình"
            hint="giải phóng GPU khi bạn cần hiệu năng"
          />
          <div className="mt-1 text-[11px] text-ph-dim">
            CHẾ ĐỘ GẮN DESKTOP: <span className="text-ph-bright">{wallpaper?.attachMode ?? '—'}</span>
          </div>
        </Panel>

        <Panel title="phím tắt" className="p-4 pt-5">
          <table className="w-full text-[12px]">
            <tbody>
              {KEYS.map(([k, v]) => (
                <tr key={k}>
                  <td className="w-28 py-1">
                    <span className="border border-crt-line-strong px-1.5 text-ph-bright">{k}</span>
                  </td>
                  <td className="py-1 text-ph-dim">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="giới thiệu" className="p-4 pt-5 text-[12px] leading-relaxed">
          <div className="font-pixel text-[26px] text-ph-bright">CHILL_LOUNGE v0.2</div>
          <p className="text-ph-dim">Hình nền động + trình phát nhạc lo-fi cho Windows. Dự án cá nhân làm cho bạn bè, lấy cảm hứng màu sắc từ cộng đồng Pyth — không phải sản phẩm chính thức của Pyth Network.</p>
        </Panel>
      </div>
    </div>
  )
}
