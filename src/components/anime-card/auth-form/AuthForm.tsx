import { ChevronLeft, Plug } from 'lucide-react'
import { useEffect, useState } from 'react'
import { sendMessage } from '@/entrypoints/background'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { useAnimeStore } from '../useAnimeStore'
import '@/styles/tailwind.css'
import type { MalCredentials } from '@/utils/types'

export default function AuthForm() {
  const authForced = useAnimeStore(s => s.authForced)
  const setView = useAnimeStore(s => s.setView)
  const notifyReconnected = useAnimeStore(s => s.notifyReconnected)

  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [hasSaved, setHasSaved] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    sendMessage({ type: 'GET_MAL_AUTH' })
      .then(res => {
        if (cancelled || !res.ok || !res.data.auth) return
        setClientId(res.data.auth.clientId)
        setClientSecret(res.data.auth.clientSecret)
        setRefreshToken(res.data.auth.refreshToken)
        setHasSaved(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function connect() {
    const creds: MalCredentials = {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      refreshToken: refreshToken.trim()
    }
    if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
      setError('Completa los tres campos.')
      return
    }
    setError('')
    setConnecting(true)
    try {
      const res = await sendMessage({ type: 'CONNECT_MAL', ...creds })
      if (!res.ok) {
        setError(res.error === 'mal_auth_failed' ? 'MAL rechazó las credenciales. Revisa el client id, el secret y el refresh token.' : res.error)
        return
      }
      pushToast(res.data.user ? `Conectado a MAL como ${res.data.user.name}` : 'Conectado a MAL')
      notifyReconnected()
    } catch {
      setError('No se pudo conectar con MAL.')
    } finally {
      setConnecting(false)
    }
  }

  const onEnter = (e: React.KeyboardEvent) => e.key === 'Enter' && !connecting && connect()

  return (
    <div className='flex flex-col gap-2'>
      {!authForced && hasSaved && (
        <Button label='Volver' icon={<ChevronLeft size={18} />} onClick={() => setView('linked')} className='self-start text-sm' type='border' />
      )}
      {authForced && <p className='text-sm text-fire'>Sin conexión con MAL: revisa tus credenciales.</p>}

      <Input label='MAL_CLIENT_ID' value={clientId} onChange={e => setClientId(e.target.value)} onKeyDown={onEnter} />
      <Input label='MAL_CLIENT_SECRET' type='password' value={clientSecret} onChange={e => setClientSecret(e.target.value)} onKeyDown={onEnter} />
      <Input
        label='MAL_REFRESH_TOKEN'
        type='password'
        value={refreshToken}
        onChange={e => setRefreshToken(e.target.value)}
        onKeyDown={onEnter}
        error={error}
        hint={
          <>
            Necesitas una app en{' '}
            <a className='text-main hover:underline' href='https://myanimelist.net/apiconfig' target='_blank' rel='noopener noreferrer'>
              myanimelist.net/apiconfig
            </a>
          </>
        }
      />

      <Button
        className='text-sm gap-1 px-2 relative'
        icon={<Plug size={20} />}
        iconPosition='right'
        label={connecting ? 'Conectando…' : 'Conectar'}
        type='border'
        disabled={connecting}
        onClick={connect}
      />
    </div>
  )
}
