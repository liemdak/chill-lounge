import { useCallback, useEffect, useRef, useState } from 'react'
import type { TrackInfo } from '../../../shared/types'
import { engine, type AmbientKey, type EQSettings } from '../audio/engine'
import type { TKey } from '../i18n'
import { load, loadArray, save } from '../lib/store'
import type { VideoQuality } from '../components/Media'

export type RepeatMode = 'off' | 'all' | 'one'
export type EQPreset = 'lofi' | 'bass' | 'vocal' | 'flat' | 'custom'
export type Soundscape = Record<AmbientKey, number>

export const EQ_PRESETS: Record<Exclude<EQPreset, 'custom'>, EQSettings & { label: TKey }> = {
  lofi: { label: 'eq.lofi', low: 5, mid: -2, high: -4, warmth: 70 },
  bass: { label: 'eq.bass', low: 8, mid: 0, high: -1, warmth: 40 },
  vocal: { label: 'eq.vocal', low: -2, mid: 4, high: 2, warmth: 15 },
  flat: { label: 'eq.flat', low: 0, mid: 0, high: 0, warmth: 0 }
}

/** Sleep timer: minutes left, 'track' = stop at the end of the current track, null = off. */
export type SleepTimer = { endsAt: number } | 'track' | null

export function usePlayer() {
  const media = engine.media
  const [queue, setQueue] = useState<TrackInfo[]>([])
  const [index, setIndex] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.7)
  const [muted, setMuted] = useState(false)
  const [shuffle, setShuffle] = useState(() => load('playback', { shuffle: false }).shuffle)
  const [repeat, setRepeat] = useState<RepeatMode>(() => load('playback', { repeat: 'all' as RepeatMode }).repeat)
  const [liked, setLiked] = useState<Set<string>>(() => new Set(loadArray<string>('liked')))
  const [eq, setEqState] = useState(() => load('eq', { preset: 'flat' as EQPreset, ...EQ_PRESETS.flat }))
  const [soundscape, setSoundscapeState] = useState<Soundscape>(() => load('soundscape', { rain: 0, vinyl: 0, fire: 0, cafe: 0 }))
  const [sleep, setSleep] = useState<SleepTimer>(null)
  /** YouTube tracks: play the muxed 360p stream so the video can be watched. */
  const [videoMode, setVideoMode] = useState(false)
  const videoModeRef = useRef(false)
  const [videoQuality, setVideoQualityState] = useState<VideoQuality>(() => load('video', { quality: 480 as VideoQuality }).quality)
  useEffect(() => {
    qualityRef.current = videoQuality
  }, [videoQuality])
  /** True while a stream is being resolved / buffered (YouTube takes a couple of seconds). */
  const [buffering, setBuffering] = useState(false)
  /** Path of the track that failed to play, if any. */
  const [error, setError] = useState<string | null>(null)
  const pendingPlay = useRef<string | null>(null)
  const restored = useRef(false)
  // Audio always comes from the audio stream; the video viewer plays a synced video-only stream.
  // (The video quality rides along so the one yt-dlp call also resolves the right video stream.)
  const qualityRef = useRef(480)
  const srcFor = (t: TrackInfo): string => window.lounge.mediaUrl(t.path, false, qualityRef.current)

  // ── restore last session ────────────────────────────────────────────────
  useEffect(() => {
    window.lounge.settings.getVolume().then((v) => {
      setVolumeState(v)
      engine.setVolume(v)
    })
    engine.setEQ(eq)
    // Local tracks are saved as paths (tags re-read on start); YouTube tracks as full objects.
    const saved = loadArray<string | TrackInfo>('queue')
    if (saved.length) {
      window.lounge.media.readTags(saved.filter((e): e is string => typeof e === 'string')).then((tags) => {
        const byPath = new Map(tags.map((t) => [t.path, t]))
        const tracks = saved.map((e) => (typeof e === 'string' ? byPath.get(e) : e)).filter((t): t is TrackInfo => !!t)
        setQueue(tracks)
        const last = load('playback', { index: 0 }).index
        setIndex(Math.min(Math.max(last, 0), tracks.length - 1))
        restored.current = true
      })
    } else restored.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!restored.current) return
    save('queue', queue.map((t) => (t.source === 'youtube' ? t : t.path)))
  }, [queue])
  useEffect(() => {
    if (restored.current) save('playback', { index, shuffle, repeat })
  }, [index, shuffle, repeat])
  useEffect(() => save('liked', [...liked]), [liked])

  // Load the current track into the media element without auto-playing (e.g. after restore).
  const loadedPath = useRef<string | null>(null)
  useEffect(() => {
    const track = queue[index]
    if (!track || loadedPath.current === track.path) return
    loadedPath.current = track.path
    media.src = srcFor(track)
    setTime(0)
    setDuration(track.duration)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media, queue, index])

  // ── transport ───────────────────────────────────────────────────────────
  const playAt = useCallback(
    (i: number) => {
      const track = queue[i]
      if (!track) return
      loadedPath.current = track.path
      media.src = srcFor(track)
      setError(null)
      setIndex(i)
      setTime(0)
      setDuration(track.duration)
      engine.resume()
      engine.restoreAmbience()
      media.play().catch(() => {})
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [media, queue]
  )

  const next = useCallback(
    (auto = false) => {
      if (queue.length === 0) return
      if (auto && sleep === 'track') {
        setSleep(null)
        return engine.fadeOutAndPause(3)
      }
      if (auto && repeat === 'one') return playAt(index)
      let i = shuffle && queue.length > 1 ? (index + 1 + Math.floor(Math.random() * (queue.length - 1))) % queue.length : index + 1
      if (i >= queue.length) {
        if (auto && repeat === 'off') return setPlaying(false)
        i = 0
      }
      playAt(i)
    },
    [queue.length, index, shuffle, repeat, sleep, playAt]
  )

  const prev = useCallback(() => {
    if (media.currentTime > 3) media.currentTime = 0
    else playAt((index - 1 + queue.length) % Math.max(queue.length, 1))
  }, [media, index, queue.length, playAt])

  const toggle = useCallback(() => {
    if (index === -1) return playAt(0)
    if (media.paused) {
      engine.resume()
      engine.restoreAmbience()
      media.play().catch(() => {})
    } else media.pause()
  }, [media, index, playAt])

  const seek = useCallback((t: number) => {
    if (Number.isFinite(t)) media.currentTime = t
  }, [media])

  useEffect(() => {
    const onPlay = (): void => {
      setPlaying(true)
      setError(null)
    }
    const onWaiting = (): void => setBuffering(true)
    const onReady = (): void => setBuffering(false)
    const onPause = (): void => setPlaying(false)
    const onTime = (): void => setTime(media.currentTime)
    const onMeta = (): void => {
      if (Number.isFinite(media.duration)) setDuration(media.duration)
    }
    const onEnded = (): void => next(true)
    const onError = (): void => {
      console.warn('[player] cannot play', media.src)
      setPlaying(false)
      setBuffering(false)
      setError(loadedPath.current)
    }
    media.addEventListener('play', onPlay)
    media.addEventListener('pause', onPause)
    media.addEventListener('timeupdate', onTime)
    media.addEventListener('loadedmetadata', onMeta)
    media.addEventListener('ended', onEnded)
    media.addEventListener('error', onError)
    for (const ev of ['loadstart', 'waiting']) media.addEventListener(ev, onWaiting)
    for (const ev of ['playing', 'canplay', 'pause', 'emptied']) media.addEventListener(ev, onReady)
    return () => {
      for (const ev of ['loadstart', 'waiting']) media.removeEventListener(ev, onWaiting)
      for (const ev of ['playing', 'canplay', 'pause', 'emptied']) media.removeEventListener(ev, onReady)
      media.removeEventListener('play', onPlay)
      media.removeEventListener('pause', onPause)
      media.removeEventListener('timeupdate', onTime)
      media.removeEventListener('loadedmetadata', onMeta)
      media.removeEventListener('ended', onEnded)
      media.removeEventListener('error', onError)
    }
  }, [media, next])

  // Windows media overlay + hardware media keys.
  useEffect(() => {
    const track = queue[index]
    if (!track || !('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: track.cover ? [{ src: track.cover }] : []
    })
    navigator.mediaSession.setActionHandler('nexttrack', () => next())
    navigator.mediaSession.setActionHandler('previoustrack', prev)
  }, [queue, index, next, prev])

  // ── queue ───────────────────────────────────────────────────────────────
  /** Append tracks (skipping ones already queued); optionally start the first one. */
  const addTracks = useCallback(
    (tracks: TrackInfo[], playNow = false) => {
      if (!tracks.length) return
      if (playNow) pendingPlay.current = tracks[0].path
      setQueue((q) => {
        const known = new Set(q.map((t) => t.path))
        return [...q, ...tracks.filter((t) => !known.has(t.path))]
      })
      if (index === -1 && !playNow) setIndex(0)
    },
    [index]
  )

  // Start a track queued with playNow once it's in the queue.
  useEffect(() => {
    const path = pendingPlay.current
    if (!path) return
    const i = queue.findIndex((t) => t.path === path)
    if (i === -1) return
    pendingPlay.current = null
    playAt(i)
  }, [queue, playAt])

  const addFiles = useCallback(async () => {
    const paths = await window.lounge.dialog.pickAudio()
    if (!paths.length) return
    addTracks(await window.lounge.media.readTags(paths))
  }, [addTracks])

  /** Show / hide the YouTube video. Audio keeps playing; the viewer syncs a video-only stream. */
  const toggleVideo = useCallback(() => {
    videoModeRef.current = !videoModeRef.current
    setVideoMode(videoModeRef.current)
  }, [])

  const setVideoQuality = useCallback((q: VideoQuality) => {
    setVideoQualityState(q)
    save('video', { quality: q })
  }, [])

  // While a track plays, resolve the next YouTube track's streams in the background
  // (and the current one's video stream when the viewer is on).
  useEffect(() => {
    if (!playing || !queue.length) return
    const cur = queue[index]
    if (videoMode && cur?.source === 'youtube') window.lounge.youtube.prefetch(cur.path.slice(3), 'video', videoQuality)
    if (queue.length < 2) return
    const nextTrack = queue[(index + 1) % queue.length]
    if (nextTrack?.source !== 'youtube') return
    window.lounge.youtube.prefetch(nextTrack.path.slice(3))
    if (videoMode) window.lounge.youtube.prefetch(nextTrack.path.slice(3), 'video', videoQuality)
  }, [playing, index, queue, videoMode, videoQuality])

  /** Turn the video view on (used by the fullscreen mode). */
  const showVideo = useCallback(() => {
    videoModeRef.current = true
    setVideoMode(true)
  }, [])

  const remove = useCallback(
    (i: number) => {
      setQueue((q) => q.filter((_, j) => j !== i))
      if (i < index) setIndex(index - 1)
      else if (i === index) {
        media.pause()
        media.removeAttribute('src')
        loadedPath.current = null
        setIndex(queue.length > 1 ? Math.min(index, queue.length - 2) : -1)
      }
    },
    [index, media, queue.length]
  )

  // ── volume / eq / ambience ──────────────────────────────────────────────
  const setVolume = useCallback((v: number) => {
    setVolumeState(v)
    setMuted(false)
    engine.setVolume(v)
    window.lounge.settings.setVolume(v)
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      engine.setVolume(m ? volume : 0)
      return !m
    })
  }, [volume])

  const setEQ = useCallback((patch: Partial<EQSettings> & { preset?: EQPreset }) => {
    setEqState((cur) => {
      const nextEq = { ...cur, preset: 'custom' as EQPreset, ...patch }
      engine.setEQ(nextEq)
      save('eq', nextEq)
      return nextEq
    })
  }, [])

  const applyPreset = useCallback(
    (p: Exclude<EQPreset, 'custom'>) => {
      const { label: _label, ...values } = EQ_PRESETS[p]
      setEQ({ ...values, preset: p })
    },
    [setEQ]
  )

  const setAmbient = useCallback((key: AmbientKey, level: number) => {
    engine.setAmbient(key, level)
    setSoundscapeState((s) => {
      const nextS = { ...s, [key]: level }
      save('soundscape', nextS)
      return nextS
    })
  }, [])

  // Re-apply saved ambience after the first user gesture (AudioContext needs one).
  useEffect(() => {
    const once = (): void => {
      for (const [k, v] of Object.entries(soundscape)) if (v > 0) engine.setAmbient(k as AmbientKey, v)
    }
    window.addEventListener('pointerdown', once, { once: true })
    return () => window.removeEventListener('pointerdown', once)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── sleep timer ─────────────────────────────────────────────────────────
  const [, tick] = useState(0)
  useEffect(() => {
    if (!sleep || sleep === 'track') return
    const id = setInterval(() => {
      if (Date.now() >= sleep.endsAt) {
        setSleep(null)
        engine.fadeOutAndPause(8)
      } else tick((n) => n + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [sleep])

  const setSleepMinutes = useCallback((m: number | 'track' | null) => {
    setSleep(m === null ? null : m === 'track' ? 'track' : { endsAt: Date.now() + m * 60_000 })
  }, [])

  const sleepLeft = sleep && sleep !== 'track' ? Math.max(0, Math.ceil((sleep.endsAt - Date.now()) / 60_000)) : null

  const current = queue[index] ?? null
  return {
    queue,
    index,
    current,
    playing,
    time,
    duration: duration || current?.duration || 0,
    volume,
    muted,
    shuffle,
    repeat,
    eq,
    soundscape,
    sleep,
    sleepLeft,
    isLiked: current ? liked.has(current.path) : false,
    videoMode,
    videoQuality,
    setVideoQuality,
    showVideo,
    buffering,
    error,
    media,
    addFiles,
    addTracks,
    toggleVideo,
    remove,
    playAt,
    toggle,
    next: () => next(),
    prev,
    seek,
    setVolume,
    toggleMute,
    setEQ,
    applyPreset,
    setAmbient,
    setSleepMinutes,
    toggleShuffle: () => setShuffle((s) => !s),
    cycleRepeat: () => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')),
    toggleLike: () =>
      current &&
      setLiked((l) => {
        const n = new Set(l)
        if (n.has(current.path)) n.delete(current.path)
        else n.add(current.path)
        return n
      })
  }
}

export type Player = ReturnType<typeof usePlayer>
