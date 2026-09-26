import { useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import type { MalAuth } from '@/utils/storage'
import './options.scss'

type StatusState = {
  message: string
  isError: boolean
} | null

export default function App() {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [status, setStatus] = useState<StatusState>(null)

  useEffect(() => {
    ;(async () => {
      const res = await browser.runtime.sendMessage({ type: 'GET_MAL_AUTH' })
      if (res?.ok && res.auth) {
        const auth = res.auth as Pick<MalAuth, 'clientId' | 'clientSecret' | 'refreshToken'>
        setClientId(auth.clientId || '')
        setClientSecret(auth.clientSecret || '')
        setRefreshToken(auth.refreshToken || '')
      }
    })()
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const res = await browser.runtime.sendMessage({
      type: 'SAVE_MAL_AUTH',
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      refreshToken: refreshToken.trim()
    })
    if (res?.ok) {
      setStatus({ message: 'Credenciales guardadas.', isError: false })
    } else {
      setStatus({ message: res?.error || 'No se pudieron guardar las credenciales.', isError: true })
    }
  }

  async function handleTestConnection() {
    setStatus({ message: 'Probando conexión…', isError: false })
    const res = await browser.runtime.sendMessage({ type: 'TEST_MAL_CONNECTION' })
    if (res?.ok) {
      setStatus({ message: `Conectado correctamente como ${res.user?.name ?? ''}.`, isError: false })
    } else {
      setStatus({ message: res?.error || 'No se pudo conectar con MAL.', isError: true })
    }
  }

  return (
    <main>
      <h1>Credenciales de MyAnimeList</h1>
      <p>
        Necesitas una app registrada en{' '}
        <a href='https://myanimelist.net/apiconfig' target='_blank' rel='noopener noreferrer'>
          myanimelist.net/apiconfig
        </a>{' '}
        y un refresh token obtenido mediante el flujo OAuth2 de MAL.
      </p>

      <form id='auth-form' onSubmit={handleSubmit}>
        <label htmlFor='client-id'>MAL_CLIENT_ID</label>
        <input id='client-id' type='text' autoComplete='off' required value={clientId} onChange={e => setClientId(e.target.value)} />

        <label htmlFor='client-secret'>MAL_CLIENT_SECRET</label>
        <input id='client-secret' type='password' autoComplete='off' required value={clientSecret} onChange={e => setClientSecret(e.target.value)} />

        <label htmlFor='refresh-token'>MAL_REFRESH_TOKEN</label>
        <input id='refresh-token' type='password' autoComplete='off' required value={refreshToken} onChange={e => setRefreshToken(e.target.value)} />

        <div className='actions'>
          <button type='submit'>Guardar</button>
          <button id='test-btn' type='button' onClick={handleTestConnection}>
            Probar conexión
          </button>
        </div>
      </form>

      {status && (
        <p id='status-msg' className={`status ${status.isError ? 'error' : 'ok'}`}>
          {status.message}
        </p>
      )}
    </main>
  )
}
