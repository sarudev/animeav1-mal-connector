import { defineConfig } from 'wxt'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  webExt: {
    binaries: {
      edge: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    },
    startUrls: ['https://animeav1.com/media/tensei-goblin-dakedo-shitsumon-aru/2'],
    chromiumProfile: resolve('./.wxt-profile'),
    keepProfileChanges: true
  },
  manifest: {
    action: {},
    permissions: ['storage'],
    host_permissions: ['https://myanimelist.net/*', 'https://api.myanimelist.net/*', 'https://animeav1.com/*']
  },
  vite: () => ({
    plugins: [tailwindcss()]
  })
})
