import { useI18n, type TKey } from '../i18n'
import { applySkin, applyTheme, SKIN_IDS, THEME_IDS, THEMES, useColorTheme, useSkin, type SkinId } from '../lib/theme'
import { Panel } from './ui'

const RAISED = 'inset -1px -1px #0a0a0a, inset 1px 1px #fff, inset -2px -2px #808080, inset 2px 2px #dfdfdf'

/** Mini mock-up of each skin, drawn with plain CSS in that skin's own look. */
function SkinPreview({ id }: { id: SkinId }) {
  const box = 'relative h-[74px] w-full overflow-hidden'
  switch (id) {
    case 'retro':
      return (
        <div className={box} style={{ background: '#07060f', fontFamily: 'VT323, monospace', color: '#c9a8ff' }}>
          <div className="px-2 pt-1.5 text-[17px] leading-none" style={{ textShadow: '0 0 6px #9d6bff' }}>
            &gt; chill_lounge
          </div>
          <div className="mx-2 mt-2 h-2" style={{ width: '60%', background: 'repeating-linear-gradient(90deg,#c9a8ff 0 5px,transparent 5px 7px)' }} />
          <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(0deg,rgba(0,0,0,.35) 0 1px,transparent 1px 3px)' }} />
        </div>
      )
    case 'glass':
      return (
        <div className={box} style={{ background: 'linear-gradient(135deg,#a8c0ff,#f3b6d8 60%,#b8f0e0)' }}>
          <div className="absolute inset-x-3 top-3 bottom-2 rounded-xl" style={{ background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.7)' }}>
            <div className="flex gap-1 p-1.5">
              {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
                <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
              ))}
            </div>
            <div className="mx-2 h-1.5 rounded-full" style={{ width: '45%', background: '#007aff' }} />
          </div>
        </div>
      )
    case 'anime':
      return (
        <div className={box} style={{ background: 'radial-gradient(#ffb3d6 1px,transparent 1.4px) 0 0/8px 8px, linear-gradient(160deg,#ffe9f4,#efe6ff)' }}>
          <div className="absolute inset-x-3 top-3.5 bottom-2 rounded-2xl" style={{ background: '#fff', border: '2px solid #cdb6ff', boxShadow: '3px 3px 0 #ffc1df' }}>
            <span className="absolute -top-2 left-2 rounded-full px-1.5 text-[9px] font-black text-white" style={{ background: '#ff5fa2', fontFamily: 'Nunito' }}>
              ✿ lo-fi
            </span>
            <div className="mx-2 mt-5 h-1.5 rounded-full" style={{ width: '55%', background: 'linear-gradient(90deg,#ff8fc7,#b18cff)' }} />
          </div>
        </div>
      )
    case 'win98':
      return (
        <div className={box} style={{ background: '#008080' }}>
          <div className="absolute inset-x-3 top-2.5 bottom-2" style={{ background: '#c0c0c0', boxShadow: RAISED }}>
            <div className="m-[3px] flex h-3 items-center justify-end px-0.5" style={{ background: 'linear-gradient(90deg,#000080,#1084d0)' }}>
              <span className="h-2 w-2.5" style={{ background: '#c0c0c0' }} />
            </div>
            <div className="mx-1.5 mt-2 h-2.5" style={{ background: '#fff', boxShadow: 'inset 1px 1px #808080' }}>
              <div className="h-full" style={{ width: '50%', background: 'repeating-linear-gradient(90deg,#000080 0 5px,transparent 5px 6px)' }} />
            </div>
          </div>
        </div>
      )
    case 'win11':
      return (
        <div className={box} style={{ background: 'radial-gradient(circle at 80% 0%,#1d3557,transparent 70%),#1c1c1c' }}>
          <div className="absolute inset-x-3 top-3 bottom-2 rounded-md" style={{ background: 'rgba(43,43,43,.85)', border: '1px solid rgba(255,255,255,.1)' }}>
            <div className="flex justify-end gap-2 px-1.5 pt-1 text-[7px] text-white/80">
              <span>─</span>
              <span>☐</span>
              <span>✕</span>
            </div>
            <div className="mx-2 mt-2 h-1 rounded-full" style={{ width: '50%', background: '#4cc2ff' }} />
          </div>
        </div>
      )
  }
}

/** Skins (the whole look) and, for the retro one, its colour themes. */
export function LookPicker() {
  const { t } = useI18n()
  const skin = useSkin()
  const theme = useColorTheme()
  return (
    <Panel title={t('set.look')} className="col-span-2 flex flex-col gap-4 p-4 pt-5">
      <div className="grid grid-cols-5 gap-3">
        {SKIN_IDS.map((id) => {
          const on = skin === id
          return (
            <button
              key={id}
              onClick={() => applySkin(id)}
              aria-pressed={on}
              className="flex flex-col overflow-hidden text-left transition-transform hover:-translate-y-0.5"
              style={{ borderRadius: 8, outline: on ? '2px solid var(--color-violet)' : '1px solid var(--color-crt-line)', outlineOffset: on ? 2 : 0 }}
            >
              <SkinPreview id={id} />
              <span className="bg-crt-panel px-2 py-1.5 text-[12px] text-ph-bright">
                {on ? '● ' : ''}
                {t(`skin.${id}` as TKey)}
              </span>
            </button>
          )
        })}
      </div>

      {skin === 'retro' && (
        <div>
          <div className="mb-2 text-[11px] text-ph-dim">{t('set.theme')}</div>
          <div className="grid grid-cols-4 gap-3 xl:grid-cols-7">
            {THEME_IDS.map((id) => {
              const th = THEMES[id]
              const on = theme === id
              return (
                <button
                  key={id}
                  onClick={() => applyTheme(id)}
                  className="flex flex-col gap-2 border p-2.5 text-left transition-transform hover:-translate-y-0.5"
                  style={{ background: th.bg, borderColor: on ? th.ph : th.phFaint, boxShadow: on ? `0 0 14px ${th.violet}66` : 'none' }}
                  aria-pressed={on}
                >
                  <span className="font-pixel text-[20px] leading-none" style={{ color: th.phBright, textShadow: `0 0 6px ${th.ph}` }}>
                    {on ? '▸ ' : ''}
                    {t(`theme.${id}` as TKey)}
                  </span>
                  <span className="text-[10.5px]" style={{ color: th.ph }}>
                    &gt; play_<span style={{ color: th.cyan }}>♪</span>
                  </span>
                  <span className="flex h-2.5 gap-0.5">
                    {[th.purple, th.violet, th.ph, th.magenta, th.cyan].map((c) => (
                      <span key={c} className="flex-1" style={{ background: c }} />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </Panel>
  )
}
