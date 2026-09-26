import { defineConfig } from 'wxt'
import { resolve } from 'node:path'

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  webExt: {
    binaries: {
      edge: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    },
    startUrls: ['https://animeav1.com/media/super-no-ura-de-yani-suu-futari/11'],
    chromiumProfile: resolve('./.wxt-profile'),
    keepProfileChanges: true
  },
  manifest: {
    permissions: ['storage', 'scripting', 'tabs'],
    host_permissions: ['https://myanimelist.net/*', 'https://api.myanimelist.net/*', 'https://animeav1.com/*']
  }
})
