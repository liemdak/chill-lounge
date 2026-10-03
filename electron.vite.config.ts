import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    // music-metadata is ESM-only; bundle it into the CJS main build.
    plugins: [externalizeDepsPlugin({ exclude: ['music-metadata'] })]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          wallpaper: resolve(__dirname, 'src/renderer/wallpaper.html')
        }
      }
    }
  }
})
