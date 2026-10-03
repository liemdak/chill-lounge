import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Lang } from '../../shared/types'

// All UI text lives here. Add a language by adding one more block with the same keys.
const vi = {
  'nav.now': 'Phát',
  'nav.library': 'Thư viện',
  'nav.youtube': 'YouTube',
  'nav.downloads': 'Tải về',
  'nav.wallpaper': 'Hình nền',
  'nav.settings': 'Cài đặt',
  'nav.profile': 'Hồ sơ',

  'win.minimize': 'Thu nhỏ',
  'win.maximize': 'Phóng to',
  'win.hide': 'Ẩn xuống khay',
  'header.desktopOn': 'DESKTOP ON',
  'header.desktopPaused': 'DESKTOP PAUSED',
  'header.desktopOff': 'DESKTOP OFF',

  'player.noTrack': '— chưa có bài —',
  'player.addHint': 'thêm nhạc ở tab THƯ VIỆN',
  'player.unknownArtist': 'Không rõ nghệ sĩ',
  'player.play': '▶ PHÁT',
  'player.pause': '❚❚ DỪNG',
  'player.pauseLong': '❚❚ TẠM DỪNG',
  'player.prev': 'Bài trước',
  'player.next': 'Bài tiếp',
  'player.shuffle': 'Phát ngẫu nhiên',
  'player.repeat': 'Lặp lại',
  'player.like': 'Yêu thích',
  'player.mute': 'Tắt tiếng (M)',
  'player.volume': 'Âm lượng',
  'player.queue': 'Hàng chờ',
  'player.wpMode': 'Chế độ wallpaper toàn màn hình (F)',

  'now.title': 'đang phát',
  'now.controls': 'điều khiển',
  'now.deck': 'bộ nhớ đệm',
  'now.wpModeBtn': '[⛶] chế độ wallpaper',
  'now.emptyHint': 'Bấm [+ THÊM NHẠC] để nạp file mp3 / flac / mp4 từ máy',
  'now.like': 'thích',
  'now.ambient': 'âm nền',
  'now.sleepTrack': 'hết bài',
  'now.tabQueue': 'hàng chờ',
  'now.tabLyrics': 'lời',
  'now.tabInfo': 'info',
  'now.tracks': '{n} bài',
  'now.queueEmpty': 'hàng chờ trống — nạp file để bắt đầu',
  'now.noLyrics': '> không tìm thấy lời trong file',
  'now.noLyricsHint': '(nhạc không lời hoặc file chưa gắn tag lyrics)',
  'now.noTrack': '> chưa có bài nào được chọn',
  'now.addMusic': '+ thêm nhạc từ máy',
  'now.removeFromQueue': 'Xóa khỏi hàng chờ',

  'wpcard.title': 'hình nền',
  'wpcard.none': 'CHƯA CHỌN',
  'wpcard.inApp': 'TRONG APP',
  'wpcard.onDesktop': 'TRÊN DESKTOP',
  'wpcard.rain': 'MƯA',
  'wpcard.bright': 'SÁNG',
  'wpcard.configure': 'cấu hình hình nền >',

  'wp.title': 'HÌNH NỀN ĐỘNG',
  'wp.choose': '+ chọn file',
  'wp.useInApp': '▣ dùng trong app',
  'wp.inUseInApp': '✓ đang dùng trong app',
  'wp.setDesktop': '▦ đặt lên desktop…',
  'wp.onDesktopNow': '✓ đang ở trên desktop',
  'wp.preview': 'màn hình xem trước',
  'wp.noSignalHint': 'chọn ảnh, gif hoặc video (mp4 / webm) để xem trước',
  'wp.notSelected': 'CHƯA CHỌN',
  'wp.effects': 'hiệu ứng (áp dụng cho app và desktop)',
  'wp.rain': 'MƯA PIXEL',
  'wp.brightness': 'ĐỘ SÁNG',
  'wp.scanlines': 'Scanline CRT',
  'wp.desktopPanel': 'desktop windows',
  'wp.desktopOff': 'Hình nền desktop đang TẮT. Ảnh/video bạn chọn chỉ hiện bên trong Chill Lounge.',
  'wp.desktopOn': 'Đang hiện trên desktop:',
  'wp.removeDesktop': 'gỡ khỏi desktop',
  'wp.resume': '▶ tiếp tục',
  'wp.pause': '❚❚ tạm dừng',
  'wp.restoreOnLaunch': 'Tự bật lại khi mở Chill Lounge',
  'wp.restoreOnLaunchHint': 'tắt thì mỗi lần mở app, desktop giữ nguyên hình nền Windows',
  'wp.fit': 'KIỂU HIỂN THỊ',
  'wp.fit.cover': 'lấp đầy',
  'wp.fit.contain': 'vừa khung',
  'wp.fit.fill': 'kéo giãn',
  'wp.autoPause': 'Tự dừng khi chơi game',
  'wp.autoPauseHint': 'khi game / app toàn màn hình đang chạy',
  'wp.recent': 'đã dùng gần đây ({n})',
  'wp.recentEmpty': '> chưa có lịch sử — chọn một ảnh hoặc video để lưu vào đây',
  'wp.forget': 'Xóa khỏi lịch sử',

  'confirm.title': 'đặt hình nền desktop',
  'confirm.body': 'Chill Lounge sẽ hiện file này phía sau các icon trên desktop Windows, thay cho hình nền hiện tại, cho tới khi bạn gỡ nó (trong app hoặc chuột phải icon ở khay hệ thống). Hình nền Windows gốc của bạn không bị xóa.',
  'confirm.restore': 'Tự bật lại mỗi khi mở Chill Lounge',
  'confirm.cancel': 'hủy',
  'confirm.ok': 'đồng ý, đặt lên desktop',

  'lib.title': 'THƯ VIỆN NHẠC',
  'lib.search': 'tìm bài, nghệ sĩ, album...',
  'lib.add': '+ thêm nhạc',
  'lib.all': 'tất cả bài hát ({n})',
  'lib.colTitle': 'TIÊU ĐỀ',
  'lib.colAlbum': 'ALBUM',
  'lib.colFormat': 'ĐỊNH DẠNG',
  'lib.colLength': 'THỜI LƯỢNG',
  'lib.noResults': '0 KẾT QUẢ',
  'lib.empty': '[ THƯ VIỆN TRỐNG ]',
  'lib.tryOther': 'thử từ khóa khác',
  'lib.emptyHint': 'bấm [+ THÊM NHẠC] để nạp mp3, flac, wav, m4a hoặc mp4',
  'lib.remove': 'Xóa',

  'dev.status': 'module status',
  'dev.badge': 'ĐANG PHÁT TRIỂN',
  'dev.note': 'bản xem trước — chưa hoạt động',
  'dev.await': '> đang chờ bản build tiếp theo',
  'yt.title': 'YOUTUBE',
  'yt.intro': 'Dán link video hoặc playlist YouTube để phát ngay trong Chill Lounge, kèm khung xem video. Đây là tính năng của bản v0.4.',
  'yt.1': 'Dán link video / playlist → phát bằng trình phát nhúng chính thức',
  'yt.2': 'Khung xem video trong tab Đang phát',
  'yt.3': 'Tìm kiếm video',
  'yt.4': 'Trộn bài YouTube và bài offline trong cùng hàng chờ',
  'dl.title': 'TẢI VỀ',
  'dl.intro': 'Tải từ link về máy để nghe offline, tải xong tự thêm vào thư viện. Đây là tính năng của bản v0.4.',
  'dl.1': 'Chọn tải CHỈ ÂM THANH (mp3) hoặc CẢ VIDEO (mp4)',
  'dl.2': 'Hàng chờ tải với % tiến độ, tạm dừng / hủy',
  'dl.3': 'Tự gắn tên bài, nghệ sĩ, ảnh bìa vào file',
  'dl.4': 'Không tải trùng bài đã có',
  'pf.title': 'HỒ SƠ',
  'pf.intro': 'Mỗi người dùng có hồ sơ và playlist riêng — lưu trên máy, hoặc đăng nhập để đồng bộ.',
  'pf.1': 'Lưu hàng chờ, EQ, âm nền, bài yêu thích trên máy',
  'pf.2': 'Nhiều hồ sơ trên cùng một máy',
  'pf.3': 'Playlist riêng cho từng hồ sơ',
  'pf.4': 'Đăng nhập online để đồng bộ playlist',

  'set.title': 'CÀI ĐẶT',
  'set.language': 'ngôn ngữ / language',
  'set.crt': 'màn hình crt',
  'set.crtStrength': 'CƯỜNG ĐỘ SCANLINE',
  'set.boot': 'Hiệu ứng khởi động',
  'set.bootHint': 'dòng boot log khi mở app',
  'set.wallpaper': 'hình nền',
  'set.attach': 'CHẾ ĐỘ GẮN DESKTOP',
  'set.keys': 'phím tắt',
  'set.about': 'giới thiệu',
  'set.aboutText': 'Hình nền động + trình phát nhạc lo-fi cho Windows. Dự án cá nhân làm cho bạn bè, lấy cảm hứng màu sắc từ cộng đồng Pyth — không phải sản phẩm chính thức của Pyth Network.',
  'key.play': 'Phát / tạm dừng',
  'key.skip': 'Bài trước / bài tiếp',
  'key.mute': 'Tắt tiếng',
  'key.wp': 'Chế độ wallpaper toàn màn hình',
  'key.nav': 'Chuyển màn hình',
  'key.esc': 'Đóng hộp thoại / thoát toàn màn hình',

  'amb.title': 'bộ trộn âm nền',
  'amb.intro': 'Các lớp âm nền chạy song song với nhạc — tạo trực tiếp bằng Web Audio, không cần file.',
  'amb.rain': 'Mưa rơi trên kính',
  'amb.vinyl': 'Đĩa than & băng từ',
  'amb.fire': 'Lò sưởi tí tách',
  'amb.cafe': 'Quán cà phê đêm',
  'amb.p.rain': 'Mưa đêm',
  'amb.p.cafe': 'Góc cà phê',
  'amb.p.fire': 'Lò sưởi',
  'amb.p.off': 'Tắt hết',

  'eq.title': 'bộ chỉnh âm lo-fi',
  'eq.lofi': 'Lo-Fi ấm',
  'eq.bass': 'Bass sâu',
  'eq.vocal': 'Giọng rõ',
  'eq.flat': 'Phẳng',
  'eq.custom': 'Tùy chỉnh',
  'eq.warmth': 'ĐỘ ẤM BĂNG TỪ (saturation)',

  'sleep.title': 'hẹn giờ ngủ',
  'sleep.intro': 'Nhạc và âm nền nhỏ dần rồi tự dừng.',
  'sleep.left': ' Còn {n} phút.',
  'sleep.off': 'Tắt hẹn giờ',
  'sleep.min': '{n} phút',
  'sleep.track': 'Hết bài này',

  'queue.title': 'hàng chờ ({n})',
  'queue.empty': '> trống',

  'saver.badge': 'CHẾ ĐỘ WALLPAPER',
  'saver.exit': '[esc] thoát',

  'update.downloading': 'ĐANG TẢI BẢN v{v}…',
  'update.ready': 'CÓ BẢN v{v}',
  'update.install': 'cài & khởi động lại',

  'close': 'Đóng'
}

const en: Record<keyof typeof vi, string> = {
  'nav.now': 'Play',
  'nav.library': 'Library',
  'nav.youtube': 'YouTube',
  'nav.downloads': 'Downloads',
  'nav.wallpaper': 'Wallpaper',
  'nav.settings': 'Settings',
  'nav.profile': 'Profile',

  'win.minimize': 'Minimize',
  'win.maximize': 'Maximize',
  'win.hide': 'Hide to tray',
  'header.desktopOn': 'DESKTOP ON',
  'header.desktopPaused': 'DESKTOP PAUSED',
  'header.desktopOff': 'DESKTOP OFF',

  'player.noTrack': '— no track —',
  'player.addHint': 'add music in the LIBRARY tab',
  'player.unknownArtist': 'Unknown artist',
  'player.play': '▶ PLAY',
  'player.pause': '❚❚ PAUSE',
  'player.pauseLong': '❚❚ PAUSE',
  'player.prev': 'Previous',
  'player.next': 'Next',
  'player.shuffle': 'Shuffle',
  'player.repeat': 'Repeat',
  'player.like': 'Like',
  'player.mute': 'Mute (M)',
  'player.volume': 'Volume',
  'player.queue': 'Queue',
  'player.wpMode': 'Fullscreen wallpaper mode (F)',

  'now.title': 'now playing',
  'now.controls': 'controls',
  'now.deck': 'buffer',
  'now.wpModeBtn': '[⛶] wallpaper mode',
  'now.emptyHint': 'Press [+ ADD MUSIC] to load mp3 / flac / mp4 files from your PC',
  'now.like': 'like',
  'now.ambient': 'ambient',
  'now.sleepTrack': 'end of track',
  'now.tabQueue': 'queue',
  'now.tabLyrics': 'lyrics',
  'now.tabInfo': 'info',
  'now.tracks': 'tracks: {n}',
  'now.queueEmpty': 'queue is empty — load files to start',
  'now.noLyrics': '> no lyrics found in this file',
  'now.noLyricsHint': '(instrumental, or the file has no lyrics tag)',
  'now.noTrack': '> no track selected',
  'now.addMusic': '+ add music from PC',
  'now.removeFromQueue': 'Remove from queue',

  'wpcard.title': 'wallpaper',
  'wpcard.none': 'NOT SET',
  'wpcard.inApp': 'IN APP',
  'wpcard.onDesktop': 'ON DESKTOP',
  'wpcard.rain': 'RAIN',
  'wpcard.bright': 'BRIGHT',
  'wpcard.configure': 'wallpaper settings >',

  'wp.title': 'LIVE WALLPAPER',
  'wp.choose': '+ choose file',
  'wp.useInApp': '▣ use in app',
  'wp.inUseInApp': '✓ in use in app',
  'wp.setDesktop': '▦ set on desktop…',
  'wp.onDesktopNow': '✓ on desktop now',
  'wp.preview': 'preview',
  'wp.noSignalHint': 'choose an image, gif or video (mp4 / webm) to preview',
  'wp.notSelected': 'NOT SELECTED',
  'wp.effects': 'effects (app and desktop)',
  'wp.rain': 'PIXEL RAIN',
  'wp.brightness': 'BRIGHTNESS',
  'wp.scanlines': 'CRT scanlines',
  'wp.desktopPanel': 'windows desktop',
  'wp.desktopOff': 'Desktop wallpaper is OFF. The image/video you choose only shows inside Chill Lounge.',
  'wp.desktopOn': 'On your desktop now:',
  'wp.removeDesktop': 'remove from desktop',
  'wp.resume': '▶ resume',
  'wp.pause': '❚❚ pause',
  'wp.restoreOnLaunch': 'Turn on again when Chill Lounge starts',
  'wp.restoreOnLaunchHint': 'when off, your normal Windows wallpaper stays after each launch',
  'wp.fit': 'FIT',
  'wp.fit.cover': 'fill',
  'wp.fit.contain': 'fit',
  'wp.fit.fill': 'stretch',
  'wp.autoPause': 'Pause during games',
  'wp.autoPauseHint': 'while a fullscreen game / app is running',
  'wp.recent': 'recent ({n})',
  'wp.recentEmpty': '> no history yet — choose an image or video to keep it here',
  'wp.forget': 'Remove from history',

  'confirm.title': 'set desktop wallpaper',
  'confirm.body': 'Chill Lounge will show this file behind your Windows desktop icons, in place of your current wallpaper, until you remove it (here, or by right-clicking the tray icon). Your original Windows wallpaper is not deleted.',
  'confirm.restore': 'Turn on again every time Chill Lounge starts',
  'confirm.cancel': 'cancel',
  'confirm.ok': 'yes, set on desktop',

  'lib.title': 'MUSIC LIBRARY',
  'lib.search': 'search title, artist, album...',
  'lib.add': '+ add music',
  'lib.all': 'all tracks ({n})',
  'lib.colTitle': 'TITLE',
  'lib.colAlbum': 'ALBUM',
  'lib.colFormat': 'FORMAT',
  'lib.colLength': 'LENGTH',
  'lib.noResults': '0 RESULTS',
  'lib.empty': '[ LIBRARY EMPTY ]',
  'lib.tryOther': 'try another keyword',
  'lib.emptyHint': 'press [+ ADD MUSIC] to load mp3, flac, wav, m4a or mp4',
  'lib.remove': 'Remove',

  'dev.status': 'module status',
  'dev.badge': 'IN DEVELOPMENT',
  'dev.note': 'preview — not working yet',
  'dev.await': '> awaiting next build',
  'yt.title': 'YOUTUBE',
  'yt.intro': 'Paste a YouTube video or playlist link to play it right in Chill Lounge, with a video viewer. Planned for v0.4.',
  'yt.1': 'Paste video / playlist link → play with the official embedded player',
  'yt.2': 'Video viewer in the Now Playing tab',
  'yt.3': 'Video search',
  'yt.4': 'Mix YouTube and offline tracks in one queue',
  'dl.title': 'DOWNLOADS',
  'dl.intro': 'Download from a link to listen offline; finished files are added to your library. Planned for v0.4.',
  'dl.1': 'Choose AUDIO ONLY (mp3) or FULL VIDEO (mp4)',
  'dl.2': 'Download queue with progress, pause / cancel',
  'dl.3': 'Title, artist and cover art written into the file',
  'dl.4': 'Skip tracks you already have',
  'pf.title': 'PROFILE',
  'pf.intro': 'Each person gets their own profile and playlists — stored locally, or synced after signing in.',
  'pf.1': 'Queue, EQ, ambience and liked tracks saved on this PC',
  'pf.2': 'Several profiles on one PC',
  'pf.3': 'Playlists per profile',
  'pf.4': 'Sign in to sync playlists',

  'set.title': 'SETTINGS',
  'set.language': 'ngôn ngữ / language',
  'set.crt': 'crt screen',
  'set.crtStrength': 'SCANLINE STRENGTH',
  'set.boot': 'Boot animation',
  'set.bootHint': 'boot log lines when the app opens',
  'set.wallpaper': 'wallpaper',
  'set.attach': 'DESKTOP ATTACH MODE',
  'set.keys': 'shortcuts',
  'set.about': 'about',
  'set.aboutText': 'Live wallpaper + lo-fi music player for Windows. A personal project made for friends, with colors inspired by the Pyth community — not an official Pyth Network product.',
  'key.play': 'Play / pause',
  'key.skip': 'Previous / next track',
  'key.mute': 'Mute',
  'key.wp': 'Fullscreen wallpaper mode',
  'key.nav': 'Switch screens',
  'key.esc': 'Close dialog / leave fullscreen',

  'amb.title': 'ambient mixer',
  'amb.intro': 'Ambient layers play alongside your music — generated live with Web Audio, no files needed.',
  'amb.rain': 'Rain on the window',
  'amb.vinyl': 'Vinyl & tape crackle',
  'amb.fire': 'Crackling fireplace',
  'amb.cafe': 'Late-night café',
  'amb.p.rain': 'Night rain',
  'amb.p.cafe': 'Café corner',
  'amb.p.fire': 'Fireplace',
  'amb.p.off': 'All off',

  'eq.title': 'lo-fi equalizer',
  'eq.lofi': 'Lo-Fi warm',
  'eq.bass': 'Deep bass',
  'eq.vocal': 'Clear vocals',
  'eq.flat': 'Flat',
  'eq.custom': 'Custom',
  'eq.warmth': 'TAPE WARMTH (saturation)',

  'sleep.title': 'sleep timer',
  'sleep.intro': 'Music and ambience fade out, then stop.',
  'sleep.left': ' {n} min left.',
  'sleep.off': 'Timer off',
  'sleep.min': '{n} min',
  'sleep.track': 'End of this track',

  'queue.title': 'queue ({n})',
  'queue.empty': '> empty',

  'saver.badge': 'WALLPAPER MODE',
  'saver.exit': '[esc] exit',

  'update.downloading': 'DOWNLOADING v{v}…',
  'update.ready': 'v{v} READY',
  'update.install': 'install & restart',

  'close': 'Close'
}

export type TKey = keyof typeof vi
const DICTS: Record<Lang, Record<TKey, string>> = { vi, en }

interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TKey, vars?: Record<string, string | number>) => string
}

const Ctx = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('vi')
  useEffect(() => {
    window.lounge.settings.getLanguage().then((l) => setLangState(l === 'en' ? 'en' : 'vi'))
  }, [])
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    window.lounge.settings.setLanguage(l)
  }, [])

  const t = useCallback(
    (key: TKey, vars?: Record<string, string | number>) => {
      let s = DICTS[lang][key] ?? key
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
      return s
    },
    [lang]
  )

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useI18n outside I18nProvider')
  return ctx
}
