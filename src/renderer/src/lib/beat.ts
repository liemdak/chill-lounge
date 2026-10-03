// Bass energy of the playing track (0..1), sampled once per frame from the shared analyser.
// The in-app VFX read it directly; the desktop wallpaper windows get it over IPC (~30 Hz).

import { readBands } from '../audio/engine'

let value = 0
let running = false
let lastSend = 0
let sendToDesktop = false

export const getBeat = (): number => value

/** Whether to forward the beat to the desktop wallpaper windows. */
export function setBeatForwarding(on: boolean): void {
  if (sendToDesktop && !on) window.lounge.wallpaper.sendBeat(0)
  sendToDesktop = on
}

export function startBeatLoop(isPlaying: () => boolean): void {
  if (running) return
  running = true
  const data = new Uint8Array(256)
  const tick = (now: number): void => {
    requestAnimationFrame(tick)
    let target = 0
    if (isPlaying()) {
      const bands = readBands(data, 12)
      target = Math.min(1, ((bands[0] + bands[1] + bands[2]) / 3) ** 1.6 * 1.4)
    }
    // fast attack, slow release
    value += (target - value) * (target > value ? 0.5 : 0.12)
    if (sendToDesktop && now - lastSend > 33) {
      lastSend = now
      window.lounge.wallpaper.sendBeat(Math.round(value * 100) / 100)
    }
  }
  requestAnimationFrame(tick)
}
