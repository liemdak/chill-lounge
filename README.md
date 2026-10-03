# Chill Lounge

Ứng dụng Windows: đặt ảnh / video làm hình nền động (nằm sau icon desktop) và trình phát nhạc "chill" phong cách **retro CRT terminal** tông tím.
Dự án cá nhân, chia sẻ cho bạn bè — màu sắc lấy cảm hứng từ cộng đồng Pyth, không phải sản phẩm chính thức của Pyth Network.

## Chạy thử

```bash
npm install
npm run dev
```

- `npm run dev` — chạy với hot reload
- `npm run build` rồi `npm start` — chạy bản build
- `npm run typecheck` — kiểm tra TypeScript

> Nếu `npm install` báo lỗi tải Electron (`fetch failed`), chạy lại với `$env:NODE_OPTIONS='--dns-result-order=ipv4first'` (PowerShell) rồi `node node_modules/electron/install.js`.

File mẫu để thử: `samples/neon-test.webm` (video wallpaper) và `samples/lofi-test.wav` (nhạc).

## Phong cách: CRT Terminal

Chọn sau góp ý của cộng đồng. Bố cục lấy từ bản Stitch → AI Studio (thư mục `design-ref/`, chỉ để tham khảo).

- Font: **VT323** (tiêu đề, đồng hồ) + **IBM Plex Mono** (nội dung) — cả hai có dấu tiếng Việt. Tránh Press Start 2P / Silkscreen vì không có dấu.
- Màu phosphor tím (`--color-ph`), viền 1px, panel có tiêu đề `┤ TÊN ├`, nút `[ NÚT ]` đảo màu khi hover.
- VFX: scanline + vệt quét + vignette + nhấp nháy CRT (chỉnh trong Cài đặt), ảnh bìa dither Bayer thành pixel art, đĩa than pixel xoay, phổ LED, mưa pixel, chữ đánh máy + glitch khi đổi bài, boot log khi mở app. Tất cả tắt bớt khi Windows bật "giảm chuyển động".

## Cấu trúc

```
src/
  main/                 Electron main process
    index.ts            cửa sổ chính, tray, IPC
    media-protocol.ts   lounge-media:// — phục vụ file local (hỗ trợ tua video)
    settings.ts         lưu cài đặt vào %APPDATA%/Chill Lounge/settings.json
    tags.ts             đọc tên bài / nghệ sĩ / ảnh bìa / lời từ file (music-metadata)
    wallpaper/
      win32.ts          gọi Win32 (koffi): gắn cửa sổ ra sau icon desktop, phát hiện app fullscreen
      manager.ts        mỗi màn hình một cửa sổ wallpaper, hiệu ứng, lịch sử, tự tạm dừng
  preload/              API an toàn cho renderer (window.lounge)
  renderer/
    index.html          giao diện chính (React + Tailwind v4)
    wallpaper.html      cửa sổ hình nền: ảnh/video + mưa pixel + độ sáng + scanline
    src/
      styles/index.css  design tokens CRT + class dùng chung (.panel, .tbtn, .blockbar…)
      audio/engine.ts   Web Audio: EQ, độ ấm băng từ, analyser, 4 lớp âm nền tổng hợp
      player/           usePlayer — hàng chờ, lặp/ngẫu nhiên, hẹn giờ ngủ, lưu phiên
      lib/              dither (pixel art), rain (mưa pixel), store (localStorage)
      components/       khung app, visualizer, hộp thoại, overlay CRT
      screens/          Đang phát, Thư viện, Hình nền, Cài đặt, các màn xem trước
  shared/types.ts       kiểu dùng chung main ↔ renderer
```

## Ghi chú kỹ thuật: wallpaper trên Windows 11 24H2+

Từ 24H2, `SHELLDLL_DefView` (icon) và `WorkerW` đều là con của `Progman`. App gắn cửa sổ vào `Progman`, xếp z-order giữa DefView và WorkerW
(xem `src/main/wallpaper/win32.ts`). Ba điểm dễ vấp đã xử lý:

1. Cửa sổ có `WS_EX_LAYERED` (do `setIgnoreMouseEvents`) phải được gọi lại `SetLayeredWindowAttributes` sau khi đổi parent, nếu không DWM không vẽ.
2. Chromium chừa viền resize ẩn ~10px quanh cửa sổ frameless → đo client rect và nới cửa sổ để bù.
3. `SHQueryUserNotificationState` báo `QUNS_BUSY` cả với cửa sổ maximize thường → chỉ coi là fullscreen khi cửa sổ foreground phủ kín cả màn hình (gồm taskbar).

## Lộ trình

- [x] Giai đoạn 0 — PoC video wallpaper trên Win11 24H2+
- [x] Giao diện retro CRT Terminal theo bố cục Stitch
- [x] Player offline: đọc tag/ảnh bìa/lời, EQ, âm nền, hẹn giờ ngủ, lưu phiên, media keys
- [x] Hiệu ứng wallpaper: mưa pixel, độ sáng, scanline, lịch sử hình nền
- [ ] Playlist riêng, quét cả thư mục nhạc
- [ ] YouTube (IFrame Player API), tìm kiếm
- [ ] Tải nhạc/video từ link (yt-dlp + ffmpeg)
- [ ] Profile local → đồng bộ online (Supabase)
- [ ] Mini player nổi, đóng gói bộ cài (electron-builder)
