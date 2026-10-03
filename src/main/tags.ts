import { basename, extname } from 'node:path'
import { parseFile } from 'music-metadata'
import { VIDEO_EXT, type TrackInfo } from '../shared/types'

const MAX_COVER_BYTES = 3 * 1024 * 1024

function fallback(path: string): TrackInfo {
  const ext = extname(path).slice(1).toLowerCase()
  return {
    path,
    title: basename(path, extname(path)),
    artist: '',
    album: '',
    duration: 0,
    format: ext.toUpperCase(),
    lossless: false,
    cover: null,
    lyrics: [],
    isVideo: VIDEO_EXT.includes(ext)
  }
}

export async function readTrackInfo(path: string): Promise<TrackInfo> {
  const info = fallback(path)
  try {
    const { common, format } = await parseFile(path, { duration: true })
    const pic = common.picture?.find((p) => p.data.length <= MAX_COVER_BYTES)
    const parts = [
      format.codec ?? format.container ?? info.format,
      format.bitrate ? `${Math.round(format.bitrate / 1000)} kbps` : null,
      format.sampleRate ? `${(format.sampleRate / 1000).toFixed(1)} kHz` : null
    ].filter(Boolean)

    const lyrics: TrackInfo['lyrics'] = []
    for (const tag of common.lyrics ?? []) {
      if (tag.syncText?.length) {
        for (const l of tag.syncText) lyrics.push({ time: (l.timestamp ?? 0) / 1000, text: l.text })
      } else if (tag.text) {
        for (const line of tag.text.split(/\r?\n/)) lyrics.push({ time: -1, text: line })
      }
    }

    return {
      ...info,
      title: common.title || info.title,
      artist: common.artist || common.albumartist || info.artist,
      album: common.album ?? '',
      duration: format.duration ?? 0,
      format: parts.join(' · '),
      lossless: format.lossless ?? false,
      cover: pic ? `data:${pic.format};base64,${Buffer.from(pic.data).toString('base64')}` : null,
      lyrics
    }
  } catch (err) {
    console.warn('[tags] could not read', path, err)
    return info
  }
}
