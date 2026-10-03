import { useState } from 'react'
import type { FitMode, WallpaperSource, WallpaperState } from '../../../shared/types'
import { EffectsPanel } from '../components/Effects'
import { Check, Modal, Panel, VfxCanvas } from '../components/ui'
import { useI18n } from '../i18n'

const FITS: FitMode[] = ['cover', 'contain', 'fill']

const ATTACH: Record<string, string> = {
  'progman-24h2': 'WIN11 24H2+',
  'workerw-legacy': 'WORKERW',
  failed: 'ATTACH FAILED'
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

/** Asks before anything is put on the Windows desktop. */
function ConfirmDesktop({ path, defaultRestore, onClose }: { path: string | null; defaultRestore: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const [restore, setRestore] = useState(defaultRestore)
  return (
    <Modal open={!!path} onClose={onClose} title={t('confirm.title')} width={480}>
      <div className="mb-3 truncate border border-crt-line px-2 py-1 text-[12px] text-ph-bright">▦ {path && fileName(path)}</div>
      <p className="mb-4 text-[12.5px] leading-relaxed text-ph">{t('confirm.body')}</p>
      <Check checked={restore} onChange={setRestore} label={t('confirm.restore')} />
      <div className="mt-5 flex justify-end gap-2">
        <button className="tbtn" onClick={onClose}>
          {t('confirm.cancel')}
        </button>
        <button
          className="tbtn primary"
          onClick={() => {
            if (path) window.lounge.wallpaper.setDesktop(path, restore)
            onClose()
          }}
        >
          {t('confirm.ok')}
        </button>
      </div>
    </Modal>
  )
}

export function WallpaperScreen({ wallpaper: wp }: { wallpaper: WallpaperState | null }) {
  const { t } = useI18n()
  const [picked, setPicked] = useState<string | null>(null)
  const [confirmPath, setConfirmPath] = useState<string | null>(null)
  if (!wp) return null

  const previewPath = picked ?? wp.source?.path ?? null
  const inApp = !!previewPath && previewPath === wp.source?.path
  const onDesktop = !!previewPath && previewPath === wp.desktop?.path
  const fx = wp.effects

  const pick = async (): Promise<void> => {
    const path = await window.lounge.dialog.pickWallpaper()
    if (path) setPicked(path)
  }

  return (
    <div className="grid grid-cols-12 gap-5 p-5 pt-6">
      <div className="col-span-8 flex min-w-0 flex-col gap-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] text-ph-dim">
              <span className="text-cyan">&gt;</span> wallpaper_engine --live
            </div>
            <h2 className="font-pixel text-[38px] leading-none text-ph-bright rgb-split">{t('wp.title')}</h2>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button className="tbtn" onClick={pick}>
              {t('wp.choose')}
            </button>
            <button className="tbtn primary" disabled={!previewPath || inApp} onClick={() => previewPath && window.lounge.wallpaper.select(previewPath).then(() => setPicked(null))}>
              {inApp ? t('wp.inUseInApp') : t('wp.useInApp')}
            </button>
            <button className="tbtn" disabled={!previewPath || onDesktop} onClick={() => setConfirmPath(previewPath)}>
              {onDesktop ? t('wp.onDesktopNow') : t('wp.setDesktop')}
            </button>
          </div>
        </div>

        <Panel title={t('wp.preview')} className="p-3 pt-4">
          <div className="relative aspect-video w-full overflow-hidden border border-crt-line bg-crt-bg">
            {previewPath ? (
              <Media path={previewPath} fit={wp.fit} brightness={fx.brightness} className="absolute inset-0 h-full w-full" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-ph-dim">
                <div className="font-pixel text-[40px] text-ph-faint">NO SIGNAL</div>
                <div className="text-[12px]">{t('wp.noSignalHint')}</div>
              </div>
            )}
            {previewPath && <VfxCanvas layers={fx} reactive={fx.reactive} className="absolute inset-0 h-full w-full" />}
            {previewPath && fx.scanlines && <div className="scanlines absolute inset-0" />}
            <div className="absolute top-2 left-2 flex gap-2">
              {inApp && <span className="badge ok bg-crt-bg/80">{t('wpcard.inApp')}</span>}
              {onDesktop && (
                <span className={`badge bg-crt-bg/80 ${wp.paused ? '' : 'live'}`}>
                  <span className="led" /> {t('wpcard.onDesktop')} · {wp.attachMode ? ATTACH[wp.attachMode] : '...'} · {wp.displays}×
                </span>
              )}
              {previewPath && !inApp && !onDesktop && <span className="badge live bg-crt-bg/80">{t('wp.notSelected')}</span>}
            </div>
            {previewPath && <div className="absolute right-2 bottom-2 left-2 truncate bg-crt-bg/80 px-2 py-1 text-[11px] text-ph-dim">{previewPath}</div>}
          </div>
        </Panel>

        <Panel title={t('fx.title')} className="p-4 pt-5">
          <EffectsPanel fx={fx} />
        </Panel>
      </div>

      <div className="col-span-4 flex min-w-0 flex-col gap-5">
        <Panel title={t('wp.desktopPanel')} className="flex flex-col gap-3 p-4 pt-5">
          {wp.desktop ? (
            <>
              <div className="text-[12px] text-ph-dim">
                {t('wp.desktopOn')}
                <div className="mt-1 truncate text-ph-bright">▦ {fileName(wp.desktop.path)}</div>
              </div>
              <div className="flex gap-2">
                <button className="tbtn flex-1 justify-center" onClick={() => window.lounge.wallpaper.togglePause()}>
                  {wp.paused ? t('wp.resume') : t('wp.pause')}
                </button>
                <button className="tbtn danger" onClick={() => window.lounge.wallpaper.setDesktop(null)}>
                  {t('wp.removeDesktop')}
                </button>
              </div>
            </>
          ) : (
            <p className="text-[12px] leading-relaxed text-ph-dim">{t('wp.desktopOff')}</p>
          )}
          <Check checked={wp.restoreOnLaunch} onChange={(v) => window.lounge.wallpaper.setRestoreOnLaunch(v)} label={t('wp.restoreOnLaunch')} hint={t('wp.restoreOnLaunchHint')} />
          <Check checked={wp.autoPause} onChange={(v) => window.lounge.wallpaper.setAutoPause(v)} label={t('wp.autoPause')} hint={t('wp.autoPauseHint')} />
          <div>
            <div className="mb-1.5 text-[11px] text-ph-dim">{t('wp.fit')}</div>
            <div className="flex gap-1">
              {FITS.map((f) => (
                <button key={f} className={`tab ${wp.fit === f ? 'active' : ''}`} onClick={() => window.lounge.wallpaper.setFit(f)}>
                  {t(`wp.fit.${f}`)}
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title={t('wp.recent', { n: wp.history.length })} className="flex min-h-0 flex-1 flex-col p-3 pt-4">
          {wp.history.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-ph-dim">{t('wp.recentEmpty')}</div>
          ) : (
            <div className="flex flex-col gap-1 overflow-y-auto">
              {wp.history.map((s: WallpaperSource) => (
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
                      {s.path === wp.source?.path && <span className="ml-2 text-cyan">● APP</span>}
                      {s.path === wp.desktop?.path && <span className="ml-2 text-magenta">● DESKTOP</span>}
                    </div>
                  </div>
                  <button
                    className="tbtn sm ghost opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.lounge.wallpaper.forget(s.path)
                    }}
                    aria-label={t('wp.forget')}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <ConfirmDesktop key={confirmPath ?? ''} path={confirmPath} defaultRestore={wp.restoreOnLaunch} onClose={() => setConfirmPath(null)} />
    </div>
  )
}
