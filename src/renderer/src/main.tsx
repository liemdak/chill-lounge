import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/vt323'
// Skin fonts (Glass, Anime). Only the Latin / Vietnamese subsets; a font file is only read
// when a skin actually uses it.
import '@fontsource/be-vietnam-pro/latin-400.css'
import '@fontsource/be-vietnam-pro/latin-ext-400.css'
import '@fontsource/be-vietnam-pro/vietnamese-400.css'
import '@fontsource/be-vietnam-pro/latin-500.css'
import '@fontsource/be-vietnam-pro/latin-ext-500.css'
import '@fontsource/be-vietnam-pro/vietnamese-500.css'
import '@fontsource/be-vietnam-pro/latin-600.css'
import '@fontsource/be-vietnam-pro/latin-ext-600.css'
import '@fontsource/be-vietnam-pro/vietnamese-600.css'
import '@fontsource/be-vietnam-pro/latin-700.css'
import '@fontsource/be-vietnam-pro/latin-ext-700.css'
import '@fontsource/be-vietnam-pro/vietnamese-700.css'
import '@fontsource/nunito/latin-600.css'
import '@fontsource/nunito/latin-ext-600.css'
import '@fontsource/nunito/vietnamese-600.css'
import '@fontsource/nunito/latin-800.css'
import '@fontsource/nunito/latin-ext-800.css'
import '@fontsource/nunito/vietnamese-800.css'
import '@fontsource/nunito/latin-900.css'
import '@fontsource/nunito/latin-ext-900.css'
import '@fontsource/nunito/vietnamese-900.css'
import './styles/index.css'
import './styles/skins.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { initTheme } from './lib/theme'

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
