import { Panel } from '../components/ui'
import { useI18n, type TKey } from '../i18n'

// Screens that exist in the design but whose features aren't built yet. They show the
// roadmap honestly instead of fake data.

function Roadmap({ cmd, title, intro, items }: { cmd: string; title: TKey; intro: TKey; items: [done: boolean, key: TKey][] }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-5 p-5 pt-6">
      <div>
        <div className="text-[11px] text-ph-dim">
          <span className="text-cyan">&gt;</span> {cmd}
        </div>
        <h2 className="font-pixel text-[38px] leading-none text-ph-bright rgb-split">{t(title)}</h2>
      </div>
      <Panel title={t('dev.status')} className="max-w-[760px] p-5 pt-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="badge live">
            <span className="led animate-blink" /> {t('dev.badge')}
          </span>
          <span className="text-[12px] text-ph-dim">{t('dev.note')}</span>
        </div>
        <p className="mb-4 text-[13px] leading-relaxed text-ph">{t(intro)}</p>
        <div className="space-y-1.5 text-[13px]">
          {items.map(([done, key]) => (
            <div key={key} className="flex gap-3">
              <span className={done ? 'text-cyan' : 'text-ph-faint'}>{done ? '[x]' : '[ ]'}</span>
              <span className={done ? 'text-ph-bright' : 'text-ph-dim'}>{t(key)}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 text-[12px] text-ph-faint">
          {t('dev.await')}
          <span className="ml-1 inline-block h-3 w-2 animate-blink bg-ph-dim align-middle" />
        </div>
      </Panel>
    </div>
  )
}

export const ProfileScreen = () => (
  <Roadmap cmd="whoami" title="pf.title" intro="pf.intro" items={[[true, 'pf.1'], [false, 'pf.2'], [false, 'pf.3'], [false, 'pf.4']]} />
)
