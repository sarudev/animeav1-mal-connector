import { defineConfig } from 'wxt'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  webExt: {
    disabled: true,
    binaries: {
      edge: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      firefox: 'C:/Program Files/Mozilla Firefox/firefox.exe'
    },
    startUrls: ['https://animeav1.com/media/tensei-goblin-dakedo-shitsumon-aru/2'],
    chromiumProfile: resolve('./.wxt-profile/edge'),
    firefoxProfile: resolve('./.wxt-profile/firefox'),
    keepProfileChanges: true
  },
  manifest: ({ browser }) => ({
    action: {},
    permissions: ['storage', 'identity'],
    host_permissions: ['https://myanimelist.net/*', 'https://api.myanimelist.net/*', 'https://animeav1.com/*'],
    ...(browser === 'firefox' && {
      browser_specific_settings: { gecko: { id: 'animeav1-mal-connector@sarudev' } }
    })
  }),
  vite: () => ({
    plugins: [tailwindcss()]
  })
})
