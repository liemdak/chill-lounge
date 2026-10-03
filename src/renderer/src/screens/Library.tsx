import { useState } from 'react'
import { Panel, PixelCover } from '../components/ui'
import { fmtTime } from '../lib/store'
import type { Player } from '../player/usePlayer'

export function Library({ p }: { p: Player }) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const rows = p.queue
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !needle || `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(needle))

  return (
    <div className="flex flex-col gap-5 p-5 pt-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] text-ph-dim">
            <span className="text-cyan">&gt;</span> ls ~/music --all
          </div>
          <h2 className="font-pixel text-[38px] leading-none text-ph-bright rgb-split">THƯ VIỆN NHẠC</h2>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-cyan">&gt;</span>
            <input className="tinput w-72 pl-6" placeholder="tìm bài, nghệ sĩ, album..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="tbtn primary" onClick={p.addFiles}>
            + thêm nhạc
          </button>
        </div>
      </div>

      <Panel title={`tất cả bài hát (${p.queue.length})`} className="pt-3">
        <div className="grid grid-cols-[40px_1fr_220px_220px_70px_32px] gap-3 border-b border-crt-line px-4 py-2 text-[10.5px] tracking-widest text-ph-dim">
          <span>#</span>
          <span>TIÊU ĐỀ</span>
          <span>ALBUM</span>
          <span>ĐỊNH DẠNG</span>
          <span className="text-right">THỜI LƯỢNG</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <div className="py-14 text-center text-ph-dim">
            <div className="font-pixel text-[30px] text-ph-faint">{p.queue.length ? '0 KẾT QUẢ' : '[ THƯ VIỆN TRỐNG ]'}</div>
            <div className="mt-1 text-[12px]">{p.queue.length ? 'thử từ khóa khác' : 'bấm [+ THÊM NHẠC] để nạp mp3, flac, wav, m4a hoặc mp4'}</div>
          </div>
        ) : (
          rows.map(({ t, i }) => (
            <div
              key={t.path}
              onClick={() => p.playAt(i)}
              className={`group grid cursor-pointer grid-cols-[40px_1fr_220px_220px_70px_32px] items-center gap-3 px-4 py-1.5 ${i === p.index ? 'row-active' : 'row-hover'}`}
            >
              <span className="text-[11px] text-ph-dim">{i === p.index && p.playing ? '▶' : String(i + 1).padStart(2, '0')}</span>
              <div className="flex min-w-0 items-center gap-3">
                <PixelCover src={t.cover} seed={t.title} res={16} className="h-8 w-8 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate">{t.title}</div>
                  <div className="truncate text-[11px] text-ph-dim">{t.artist}</div>
                </div>
              </div>
              <span className="truncate text-[12px] text-ph-dim">{t.album || '—'}</span>
              <span className="truncate text-[11px] text-ph-dim">
                {t.format}
                {t.lossless && <span className="ml-1.5 text-cyan">LOSSLESS</span>}
              </span>
              <span className="text-right text-[12px]">{fmtTime(t.duration)}</span>
              <button
                className="tbtn sm ghost opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  p.remove(i)
                }}
                aria-label="Xóa"
              >
                ×
              </button>
            </div>
          ))
        )}
      </Panel>
    </div>
  )
}
