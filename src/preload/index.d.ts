import type { LoungeApi } from './index'

declare global {
  interface Window {
    lounge: LoungeApi
  }
}
