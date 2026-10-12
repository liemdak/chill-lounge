import { useEffect, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { UpdateStatus } from '../../../shared/types'
import { useI18n } from '../i18n'
import { load, save } from '../lib/store'

// One shared view of the updater for the prompt, the header badge and the Settings button.
let status: UpdateStatus = { state: 'idle' }
/** Version whose prompt the user closed with "Later" (the badge can bring it back). */
let dismissed = load('update', { dismissed: '' }).dismissed
const listeners = new Set<() => void>()
const emit = (): void => listeners.forEach((fn) => fn())
let wired = false

function wire(): void {
  if (wired) return
  wired = true
  window.lounge.app.updateStatus().then((s) => ((status = s), emit()))
  window.lounge.app.onUpdate((s) => ((status = s), emit()))
}

const subscribe = (fn: () => void): (() => void) => {
  wire()
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useUpdate(): { status: UpdateStatus; promptOpen: boolean } {
  const s = useSyncExternalStore(subscribe, () => status)
  const d = useSyncExternalStore(subscribe, () => dismissed)
  const promptOpen = (s.state === 'available' || s.state === 'downloading' || s.state === 'ready') && d !== `${s.state === 'ready' ? 'ready:' : ''}${s.version}`
  return { status: s, promptOpen }
}

const dismiss = (key: string): void => {
  dismissed = key
  save('update', { dismissed: key })
  emit()
}
/** Bring the prompt back (header badge). */
export const reopenUpdate = (): void => dismiss('')

/** Bottom-right card: a new version exists → update now / later → progress → restart to install. */
export function UpdatePrompt() {
  const { t } = useI18n()
  const { status: s, promptOpen } = useUpdate()
  useEffect(() => wire(), [])
  const open = promptOpen && (s.state === 'available' || s.state === 'downloading' || s.state === 'ready')

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="panel fixed right-5 bottom-[92px] z-[150] w-[340px] p-4 pt-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          role="dialog"
          aria-label={t('update.title')}
        >
          <span className="panel-title">{t('update.title')}</span>
          <div className="text-[15px] font-semibold text-ph-bright">Chill Lounge v{s.version}</div>
          {s.notes && (
            <>
              <div className="mt-2 text-[11px] text-ph-dim">{t('update.notes')}</div>
              <div className="mt-1 max-h-[150px] overflow-y-auto pr-1 text-[12px] leading-relaxed whitespace-pre-line text-ph">{s.notes}</div>
            </>
          )}

          {s.state === 'available' && (
            <div className="mt-4 flex justify-end gap-2">
              <button className="tbtn sm ghost" onClick={() => dismiss(s.version)}>
                {t('update.later')}
              </button>
              <button className="tbtn sm primary" onClick={window.lounge.app.downloadUpdate}>
                {t('update.now')}
              </button>
            </div>
          )}
          {s.state === 'downloading' && (
            <div className="mt-4">
              <div className="mb-1.5 text-[11px] text-ph-dim">{t('update.downloading', { v: s.version, p: s.percent })}</div>
              <div className="blockbar">
                <div className="fill" style={{ width: `${s.percent}%` }} />
              </div>
            </div>
          )}
          {s.state === 'ready' && (
            <>
              <div className="mt-3 text-[12px] text-cyan">{t('update.ready', { v: s.version })}</div>
              <div className="mt-3 flex justify-end gap-2">
                <button className="tbtn sm ghost" onClick={() => dismiss(`ready:${s.version}`)}>
                  {t('update.installLater')}
                </button>
                <button className="tbtn sm primary" onClick={window.lounge.app.installUpdate}>
                  {t('update.install')}
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Header badge while an update is waiting; brings the prompt back. */
export function UpdateBadge({ style }: { style?: React.CSSProperties }) {
  const { t } = useI18n()
  const { status: s, promptOpen } = useUpdate()
  if (promptOpen || !(s.state === 'available' || s.state === 'downloading' || s.state === 'ready')) return null
  return (
    <button className="tbtn sm on" style={style} onClick={reopenUpdate}>
      ↑ {t('update.badge', { v: s.version })}
    </button>
  )
}

/** Settings: current state + "check for updates". */
export function UpdateCheck() {
  const { t } = useI18n()
  const { status: s } = useUpdate()
  const line =
    s.state === 'checking'
      ? t('update.checking')
      : s.state === 'latest'
        ? t('update.latest')
        : s.state === 'dev'
          ? t('update.dev')
          : s.state === 'error'
            ? t('update.error', { e: s.message.slice(0, 120) })
            : s.state === 'available' || s.state === 'downloading' || s.state === 'ready'
              ? t('update.badge', { v: s.version })
              : ''
  return (
    <div className="mt-3 flex items-center gap-3">
      <button className="tbtn sm" disabled={s.state === 'checking' || s.state === 'downloading'} onClick={() => (reopenUpdate(), void window.lounge.app.checkUpdate())}>
        {t('update.check')}
      </button>
      <span className={`text-[11px] ${s.state === 'error' ? 'text-magenta' : 'text-ph-dim'}`}>{line}</span>
    </div>
  )
}
