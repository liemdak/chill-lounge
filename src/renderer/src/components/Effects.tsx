import { useState } from 'react'
import { CUSTOM_VFX_MAX_MB, type CustomVfx, type WallpaperEffects } from '../../../shared/types'
import { useI18n, type TKey } from '../i18n'
import { VFX_KEYS, VFX_PRESETS, type VfxKey, type VfxLayers } from '../lib/vfx'
import { Check, TRange } from './ui'

const LAYER_COLOR: Record<VfxKey, string> = {
  rain: 'text-cyan',
  snow: 'text-ph-bright',
  fireflies: 'text-[#ffe28c]',
  stars: 'text-ph',
  glyphs: 'text-violet',
  petals: 'text-[#ff9ad5]',
  fog: 'text-ph-dim',
  vhs: 'text-magenta'
}

const set = (patch: Partial<WallpaperEffects>): void => void window.lounge.wallpaper.setEffects(patch)

function activePreset(fx: VfxLayers): string | null {
  return VFX_PRESETS.find((p) => VFX_KEYS.every((k) => p.layers[k] === fx[k]))?.id ?? null
}

function Presets({ fx, small = false }: { fx: WallpaperEffects; small?: boolean }) {
  const { t } = useI18n()
  const current = activePreset(fx)
  return (
    <div className={small ? 'flex gap-1 overflow-x-auto pb-1' : 'flex flex-wrap gap-1.5'}>
      {VFX_PRESETS.map((p) => (
        <button key={p.id} className={`tbtn sm shrink-0 ${small ? '!h-[22px] !px-1.5 !text-[10px]' : ''} ${current === p.id ? 'on' : ''}`} onClick={() => set(p.layers)}>
          {t(`fxp.${p.id}` as TKey)}
        </button>
      ))}
    </div>
  )
}

/** Full editor: presets, one slider per layer, brightness, scanlines, music reaction. */
export function EffectsPanel({ fx }: { fx: WallpaperEffects }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5 text-[11px] text-ph-dim">{t('fx.presets')}</div>
        <Presets fx={fx} />
      </div>
      <div className="grid grid-cols-4 gap-x-5 gap-y-3">
        {VFX_KEYS.map((k) => (
          <label key={k} className="flex flex-col gap-1 text-[11px]">
            <span className="flex justify-between text-ph-dim">
              {t(`fx.${k}` as TKey)} <span className={fx[k] > 0 ? LAYER_COLOR[k] : 'text-ph-faint'}>{fx[k]}%</span>
            </span>
            <TRange label={t(`fx.${k}` as TKey)} min={0} max={100} step={1} value={fx[k]} onChange={(v) => set({ [k]: v })} />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-3 items-start gap-5 border-t border-crt-line pt-3">
        <label className="flex flex-col gap-1 text-[11px]">
          <span className="flex justify-between text-ph-dim">
            {t('fx.brightness')} <span className="text-magenta">{fx.brightness}%</span>
          </span>
          <TRange label={t('fx.brightness')} min={30} max={100} step={1} value={fx.brightness} onChange={(v) => set({ brightness: v })} />
        </label>
        <div className="text-[12px]">
          <Check checked={fx.reactive} onChange={(v) => set({ reactive: v })} label={t('fx.reactive')} hint={t('fx.reactiveHint')} />
        </div>
        <div className="text-[12px]">
          <Check checked={fx.scanlines} onChange={(v) => set({ scanlines: v })} label={t('wp.scanlines')} />
        </div>
      </div>
      <CustomVfxEditor fx={fx} />
    </div>
  )
}

/** The user's own effect: upload a particle image or an overlay, then tune it. */
function CustomVfxEditor({ fx }: { fx: WallpaperEffects }) {
  const { t } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const c = fx.custom
  const patch = (p: Partial<CustomVfx>): void => {
    if (c) set({ custom: { ...c, ...p } })
  }
  const upload = async (kind: CustomVfx['kind']): Promise<void> => {
    setError(null)
    try {
      await window.lounge.wallpaper.importCustomVfx(kind)
    } catch (e) {
      const msg = (e as Error).message
      setError(msg.includes('vfx-too-big') ? t('fx.err.tooBig', { max: `${CUSTOM_VFX_MAX_MB[kind]} MB` }) : t('fx.err.type'))
    }
  }
  const slider = (key: 'amount' | 'size' | 'speed' | 'opacity', min: number, max: number, unit = '%') => (
    <label className="flex flex-col gap-1 text-[11px]">
      <span className="flex justify-between text-ph-dim">
        {t(`fx.${key}` as TKey)}
        <span className="text-ph-bright">
          {c![key]}
          {unit}
        </span>
      </span>
      <TRange label={t(`fx.${key}` as TKey)} min={min} max={max} step={1} value={c![key]} onChange={(v) => patch({ [key]: v })} />
    </label>
  )

  return (
    <div className="border-t border-crt-line pt-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-[12px] text-ph-bright">{t('fx.custom')}</span>
        <div className="flex gap-1.5">
          <button className="tbtn sm" onClick={() => upload('particle')}>
            {t('fx.uploadParticle')}
          </button>
          <button className="tbtn sm" onClick={() => upload('overlay')}>
            {t('fx.uploadOverlay')}
          </button>
          {c && (
            <button className="tbtn sm danger" onClick={() => window.lounge.wallpaper.removeCustomVfx()}>
              {t('fx.remove')}
            </button>
          )}
        </div>
      </div>
      {!c && <p className="text-[11px] leading-relaxed text-ph-dim">{t('fx.customHint')}</p>}
      {error && <p className="mt-1 text-[11px] text-magenta">{error}</p>}
      {c && (
        <div className="mt-2 flex flex-col gap-3">
          <div className="truncate text-[11px] text-ph-dim">
            {t(c.kind === 'particle' ? 'fx.particle' : 'fx.overlay')} · <span className="text-ph">{c.name}</span>
          </div>
          {c.kind === 'particle' ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="mr-1 text-[11px] text-ph-dim">{t('fx.motion')}</span>
                {(['fall', 'float', 'drift'] as const).map((m) => (
                  <button key={m} className={`tab ${c.motion === m ? 'active' : ''}`} onClick={() => patch({ motion: m })}>
                    {t(`fx.motion.${m}` as TKey)}
                  </button>
                ))}
                <span className="ml-3">
                  <Check checked={c.spin} onChange={(v) => patch({ spin: v })} label={t('fx.spin')} />
                </span>
              </div>
              <div className="grid grid-cols-3 gap-5">
                {slider('amount', 0, 100)}
                {slider('size', 8, 96, 'px')}
                {slider('speed', 0, 100)}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-3 items-start gap-5">
              {slider('opacity', 10, 100)}
              <div className="col-span-2 text-[12px]">
                <Check checked={c.blend === 'screen'} onChange={(v) => patch({ blend: v ? 'screen' : 'normal' })} label={t('fx.blendScreen')} hint={t('fx.blendHint')} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Compact version for the Now Playing card: presets + music reaction. */
export function EffectsQuick({ fx }: { fx: WallpaperEffects }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-1">
      <Presets fx={fx} small />
      <div className="text-[11.5px]">
        <Check checked={fx.reactive} onChange={(v) => set({ reactive: v })} label={t('fx.reactive')} />
      </div>
    </div>
  )
}
