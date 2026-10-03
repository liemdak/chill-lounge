import { Panel } from '../components/ui'

// Screens that exist in the design but whose features aren't built yet. They show the
// roadmap honestly instead of fake data.

function Roadmap({ cmd, title, intro, items }: { cmd: string; title: string; intro: string; items: [done: boolean, text: string][] }) {
  return (
    <div className="flex flex-col gap-5 p-5 pt-6">
      <div>
        <div className="text-[11px] text-ph-dim">
          <span className="text-cyan">&gt;</span> {cmd}
        </div>
        <h2 className="font-pixel text-[38px] leading-none text-ph-bright rgb-split">{title}</h2>
      </div>
      <Panel title="module status" className="max-w-[760px] p-5 pt-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="badge live">
            <span className="led animate-blink" /> ĐANG PHÁT TRIỂN
          </span>
          <span className="text-[12px] text-ph-dim">bản xem trước — chưa hoạt động</span>
        </div>
        <p className="mb-4 text-[13px] leading-relaxed text-ph">{intro}</p>
        <div className="space-y-1.5 text-[13px]">
          {items.map(([done, text]) => (
            <div key={text} className="flex gap-3">
              <span className={done ? 'text-cyan' : 'text-ph-faint'}>{done ? '[x]' : '[ ]'}</span>
              <span className={done ? 'text-ph-bright' : 'text-ph-dim'}>{text}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 text-[12px] text-ph-faint">
          &gt; awaiting next build<span className="ml-1 inline-block h-3 w-2 animate-blink bg-ph-dim align-middle" />
        </div>
      </Panel>
    </div>
  )
}

export const YouTubeScreen = () => (
  <Roadmap
    cmd="yt --connect"
    title="YOUTUBE"
    intro="Dán link video hoặc playlist YouTube để phát ngay trong Chill Lounge, kèm khung xem video. Âm lượng điều khiển được; EQ và âm nền vẫn áp dụng cho nhạc offline."
    items={[
      [false, 'Dán link video / playlist → phát bằng trình phát nhúng chính thức'],
      [false, 'Khung xem video trong tab Đang phát'],
      [false, 'Tìm kiếm bằng YouTube Data API'],
      [false, 'Trộn bài YouTube và bài offline trong cùng hàng chờ']
    ]}
  />
)

export const DownloadsScreen = () => (
  <Roadmap
    cmd="dl --queue"
    title="TẢI VỀ"
    intro="Tải audio hoặc video từ link về máy để nghe offline. Dùng yt-dlp + ffmpeg đóng gói sẵn, tự cập nhật, tải xong tự thêm vào thư viện."
    items={[
      [false, 'Hàng chờ tải với % tiến độ, tạm dừng / hủy'],
      [false, 'Chọn chỉ audio (mp3) hoặc cả video (mp4)'],
      [false, 'Tự gắn tên bài, nghệ sĩ, ảnh bìa vào file'],
      [false, 'Không tải trùng bài đã có']
    ]}
  />
)

export const ProfileScreen = () => (
  <Roadmap
    cmd="whoami"
    title="HỒ SƠ"
    intro="Mỗi người dùng có hồ sơ và playlist riêng — lưu trên máy, hoặc đăng nhập để đồng bộ giữa các máy."
    items={[
      [true, 'Lưu hàng chờ, EQ, âm nền, bài yêu thích trên máy'],
      [false, 'Nhiều hồ sơ local trên cùng một máy'],
      [false, 'Playlist riêng cho từng hồ sơ'],
      [false, 'Đăng nhập online để đồng bộ playlist']
    ]}
  />
)
