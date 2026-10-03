import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import type { WallpaperState } from '../../shared/types'
import { Header, NAV, NAV_BOTTOM, PlayerBar, Sidebar, type Screen } from './components/Chrome'
import { AmbientModal, AppBackdrop, BootScreen, CrtOverlay, EQModal, QueueModal, SleepModal, WallpaperMode } from './components/Overlays'
import { I18nProvider } from './i18n'
import { setBeatForwarding, startBeatLoop } from './lib/beat'
import { load, save } from './lib/store'
import { usePlayer } from './player/usePlayer'
import { Library } from './screens/Library'
import { NowPlaying } from './screens/NowPlaying'
import { DownloadsScreen, ProfileScreen, YouTubeScreen } from './screens/Preview'
import { SettingsScreen, type UiPrefs } from './screens/Settings'
import { WallpaperScreen } from './screens/Wallpaper'

type ModalId = 'ambient' | 'eq' | 'sleep' | 'queue' | 'wpmode' | null

export function App() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  )
}

function Shell() {
  const p = usePlayer()
  const [screen, setScreen] = useState<Screen>('now')
  const [modal, setModal] = useState<ModalId>(null)
  const [wallpaper, setWallpaper] = useState<WallpaperState | null>(null)
  const [prefs, setPrefsState] = useState<UiPrefs>(() => load('prefs', { crt: 0.55, boot: true }))
  const setPrefs = (v: UiPrefs): void => {
    setPrefsState(v)
    save('prefs', v)
  }
  // Stable identity: dialogs use it inside effects.
  const close = useCallback(() => setModal(null), [])

  // Bass-energy meter for music-reactive VFX; forwarded to the desktop only when it's needed.
  const playingRef = useRef(false)
  playingRef.current = p.playing
  useEffect(() => startBeatLoop(() => playingRef.current), [])
  useEffect(() => setBeatForwarding(!!wallpaper?.desktop && !!wallpaper.effects.reactive), [wallpaper?.desktop, wallpaper?.effects.reactive])

  useEffect(() => {
    window.lounge.wallpaper.getState().then(setWallpaper)
    return window.lounge.wallpaper.onState(setWallpaper)
  }, [])

  // Global keyboard shortcuts (ignored while typing in an input).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      const nav = [...NAV, ...NAV_BOTTOM].find((n) => n.key === e.key)
      if (nav) {
        e.preventDefault()
        return setScreen(nav.id)
      }
      if (modal && modal !== 'wpmode') return
      if (e.code === 'Space') {
        e.preventDefault()
        p.toggle()
      } else if (e.key === 'l' || e.key === 'L') p.next()
      else if (e.key === 'j' || e.key === 'J') p.prev()
      else if (e.key === 'm' || e.key === 'M') p.toggleMute()
      else if (e.key === 'f' || e.key === 'F') setModal((m) => (m === 'wpmode' ? null : 'wpmode'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [p, modal])

  return (
    <MotionConfig reducedMotion="user">
      <AppBackdrop wallpaper={wallpaper} />
      <div className="relative z-10 flex h-full flex-col">
        <Header wallpaper={wallpaper} />
        <div className="flex min-h-0 flex-1">
          <Sidebar screen={screen} onNavigate={setScreen} />
          <main className="min-w-0 flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={screen}
                className="h-full"
                initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
                animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)', transitionEnd: { clipPath: 'none' } }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: 'linear' }}
              >
                {screen === 'now' && (
                  <NowPlaying
                    p={p}
                    wallpaper={wallpaper}
                    onOpenAmbient={() => setModal('ambient')}
                    onOpenEQ={() => setModal('eq')}
                    onOpenSleep={() => setModal('sleep')}
                    onOpenWallpaperMode={() => setModal('wpmode')}
                    onGoWallpaper={() => setScreen('wallpaper')}
                  />
                )}
                {screen === 'library' && <Library p={p} />}
                {screen === 'youtube' && <YouTubeScreen />}
                {screen === 'downloads' && <DownloadsScreen />}
                {screen === 'wallpaper' && <WallpaperScreen wallpaper={wallpaper} />}
                {screen === 'settings' && <SettingsScreen prefs={prefs} onPrefs={setPrefs} wallpaper={wallpaper} />}
                {screen === 'profile' && <ProfileScreen />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        <PlayerBar p={p} onOpenQueue={() => setModal('queue')} onOpenWallpaperMode={() => setModal('wpmode')} />
      </div>

      <AmbientModal open={modal === 'ambient'} onClose={close} p={p} />
      <EQModal open={modal === 'eq'} onClose={close} p={p} />
      <SleepModal open={modal === 'sleep'} onClose={close} p={p} />
      <QueueModal open={modal === 'queue'} onClose={close} p={p} />
      <WallpaperMode open={modal === 'wpmode'} onClose={close} p={p} wallpaper={wallpaper} />
      <BootScreen enabled={prefs.boot} />
      <CrtOverlay strength={prefs.crt} />
    </MotionConfig>
  )
}
