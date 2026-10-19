import { browser } from 'wxt/browser'
import { MalAuthError, TOKEN_URL, getCurrentUser, type MalUser } from '@/utils/mal'
import { setMalAuth } from '@/utils/storage'

const AUTH_URL = 'https://myanimelist.net/v1/oauth2/authorize'

function randomString(bytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function doLogin(clientId: string): Promise<void> {
  const redirectUri = browser.identity.getRedirectURL()
  const verifier = randomString(64)
  const state = randomString(16)

  const authUrl =
    `${AUTH_URL}?` +
    new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: verifier,
      code_challenge_method: 'plain',
      state
    })

  let redirected: string | undefined
  try {
    redirected = await browser.identity.launchWebAuthFlow({ url: authUrl, interactive: true })
  } catch (err) {
    throw new MalAuthError('mal_login_aborted', (err as Error).message)
  }
  if (!redirected) throw new MalAuthError('mal_login_aborted', 'Sin respuesta del flujo de autorización.')

  const params = new URL(redirected).searchParams
  const oauthError = params.get('error')
  if (oauthError) {
    throw new MalAuthError(oauthError === 'access_denied' ? 'mal_login_aborted' : 'mal_auth_failed', `MAL respondió: ${oauthError}`)
  }
  if (params.get('state') !== state) throw new MalAuthError('mal_auth_failed', 'El parámetro state no coincide.')
  const code = params.get('code')
  if (!code) throw new MalAuthError('mal_auth_failed', 'MAL no devolvió un código.')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })
  })

  if (!res.ok) {
    const msg = `No se pudo canjear el código (${res.status})`
    throw res.status === 400 || res.status === 401 ? new MalAuthError('mal_auth_failed', msg) : new Error(msg)
  }

  const data = await res.json()
  await setMalAuth({
    clientId,
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
    accessTokenExpiry: Date.now() + (data.expires_in || 0) * 1000 - 60000
  })
}

let loginInFlight: Promise<void> | null = null

export async function connectMal(clientId: string): Promise<MalUser | null> {
  await (loginInFlight ??= doLogin(clientId).finally(() => {
    loginInFlight = null
  }))
  return getCurrentUser().catch(() => null)
}
