import { useEffect, useState } from 'react'
import type { WallpaperState } from '../../../shared/types'
import { Check, Panel, TRange } from '../components/ui'
import { useI18n, type TKey } from '../i18n'

export interface UiPrefs {
  crt: number
  boot: boolean
}

const KEYS: [string, TKey][] = [
  ['Space', 'key.play'],
  ['J / L', 'key.skip'],
  ['M', 'key.mute'],
  ['F', 'key.wp'],
  ['F1 – F7', 'key.nav'],
  ['Esc', 'key.esc']
]

export function SettingsScreen({ prefs, onPrefs, wallpaper }: { prefs: UiPrefs; onPrefs: (p: UiPrefs) => void; wallpaper: WallpaperState | null }) {
  const { t, lang, setLang } = useI18n()
  const [version, setVersion] = useState('')
  useEffect(() => {
    window.lounge.app.version().then(setVersion)
  }, [])

  return (
    <div className="flex flex-col gap-5 p-5 pt-6">
      <div>
        <div className="text-[11px] text-ph-dim">
          <span className="text-cyan">&gt;</span> config --edit
        </div>
        <h2 className="font-pixel text-[38px] leading-none text-ph-bright rgb-split">{t('set.title')}</h2>
      </div>

      <div className="grid max-w-[1100px] grid-cols-2 gap-5">
        <Panel title={t('set.language')} className="flex gap-2 p-4 pt-5">
          {(
            [
              ['vi', 'Tiếng Việt'],
              ['en', 'English']
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={`tbtn flex-1 justify-center ${lang === id ? 'on' : ''}`} onClick={() => setLang(id)}>
              {lang === id ? '● ' : ''}
              {label}
            </button>
          ))}
        </Panel>

        <Panel title={t('set.crt')} className="flex flex-col gap-3 p-4 pt-5">
          <label className="flex flex-col gap-1.5 text-[12px]">
            <span className="flex justify-between text-ph-dim">
              {t('set.crtStrength')} <span className="text-cyan">{Math.round(prefs.crt * 100)}%</span>
            </span>
            <TRange label={t('set.crtStrength')} min={0} max={1} step={0.05} value={prefs.crt} onChange={(v) => onPrefs({ ...prefs, crt: v })} />
          </label>
          <Check checked={prefs.boot} onChange={(v) => onPrefs({ ...prefs, boot: v })} label={t('set.boot')} hint={t('set.bootHint')} />
        </Panel>

        <Panel title={t('set.wallpaper')} className="flex flex-col gap-2 p-4 pt-5">
          <Check checked={wallpaper?.restoreOnLaunch ?? false} onChange={(v) => window.lounge.wallpaper.setRestoreOnLaunch(v)} label={t('wp.restoreOnLaunch')} hint={t('wp.restoreOnLaunchHint')} />
          <Check checked={wallpaper?.autoPause ?? true} onChange={(v) => window.lounge.wallpaper.setAutoPause(v)} label={t('wp.autoPause')} hint={t('wp.autoPauseHint')} />
          <div className="mt-1 text-[11px] text-ph-dim">
            {t('set.attach')}: <span className="text-ph-bright">{wallpaper?.attachMode ?? '—'}</span>
          </div>
        </Panel>

        <Panel title={t('set.keys')} className="p-4 pt-5">
          <table className="w-full text-[12px]">
            <tbody>
              {KEYS.map(([k, v]) => (
                <tr key={k}>
                  <td className="w-28 py-1">
                    <span className="border border-crt-line-strong px-1.5 text-ph-bright">{k}</span>
                  </td>
                  <td className="py-1 text-ph-dim">{t(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title={t('set.about')} className="col-span-2 p-4 pt-5 text-[12px] leading-relaxed">
          <div className="font-pixel text-[26px] text-ph-bright">CHILL_LOUNGE v{version}</div>
          <p className="text-ph-dim">{t('set.aboutText')}</p>
          <p className="mt-1 text-ph-faint">github.com/liemdak/chill-lounge</p>
        </Panel>
      </div>
    </div>
  )
}
