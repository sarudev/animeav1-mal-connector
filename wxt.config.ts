import { defineConfig } from 'wxt'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  webExt: {
    disabled: true
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
