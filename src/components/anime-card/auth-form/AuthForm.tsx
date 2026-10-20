import { Check, Copy, Plug } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { sendMessage } from '@/entrypoints/background'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { useAnimeStore } from '../useAnimeStore'
import { AuthFormActions } from './AuthFormActions'
import '@/styles/tailwind.css'

const GUIDE_URL = 'https://github.com/sarudev/animeav1-mal-connector#configuración-inicial'
const MAL_APICONFIG_URL = 'https://myanimelist.net/apiconfig'

export default function AuthForm() {
  const { authForced, notifyReconnected } = useAnimeStore()

  const [redirectUrl, setRedirectUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [clientId, setClientId] = useState('')
  const [hasSaved, setHasSaved] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  const redirectRef = useRef<HTMLInputElement>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    let cancelled = false

    sendMessage({ type: 'GET_REDIRECT_URL' })
      .then(res => {
        if (!cancelled && res.ok) setRedirectUrl(res.data.url)
      })
      .catch(() => {})

    sendMessage({ type: 'GET_MAL_AUTH' })
      .then(res => {
        if (cancelled || !res.ok || !res.data.auth) return
        setClientId(res.data.auth.clientId)
        setHasSaved(true)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      clearTimeout(copyTimer.current)
    }
  }, [])

  async function copyRedirectUrl() {
    if (!redirectUrl) return
    try {
      await navigator.clipboard.writeText(redirectUrl)
    } catch {
      redirectRef.current?.select()
      document.execCommand('copy')
    }
    setCopied(true)
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 1500)
  }

  function describeError(code: string): string {
    switch (code) {
      case 'mal_login_aborted':
        return 'No se completó el inicio de sesión. Si MAL mostró un error, revisa que la URL de redirección esté registrada en tu app.'
      case 'mal_auth_failed':
        return 'MAL rechazó la autorización. Revisa el client id.'
      default:
        return code
    }
  }

  async function connect() {
    const id = clientId.trim()
    if (!id) {
      setError('Ingresa el client id de tu app.')
      return
    }
    setError('')
    setConnecting(true)
    try {
      const res = await sendMessage({ type: 'CONNECT_MAL', clientId: id })
      if (!res.ok) {
        setError(describeError(res.error))
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
        <AuthFormActions
          onCleared={() => {
            setClientId('')
            setError('')
            setHasSaved(false)
          }}
        />
      )}
      {authForced && <p className='text-sm text-fire'>Sin conexión con MAL: vuelve a conectar tu cuenta.</p>}

      <Input
        ref={redirectRef}
        label='URL de redirección'
        className='pr-10'
        value={redirectUrl}
        readOnly
        placeholder='Cargando…'
        trailing={<Button icon={copied ? <Check size={16} /> : <Copy size={16} />} disabled={!redirectUrl} onClick={copyRedirectUrl} />}
        hint={
          <>
            Configuralo{' '}
            <a className='text-main hover:underline' href={MAL_APICONFIG_URL} target='_blank' rel='noopener noreferrer'>
              acá
            </a>
          </>
        }
      />

      <Input
        label='Client ID'
        value={clientId}
        onChange={e => setClientId(e.target.value)}
        onKeyDown={onEnter}
        error={error}
        hint={
          <>
            ¿Primera vez?{' '}
            <a
              className='text-main hover:underline'
              href={GUIDE_URL}
              target='_blank'
              rel='noopener noreferrer'
              onClick={e => GUIDE_URL === '#' && e.preventDefault()}
            >
              Mira la guía
            </a>
          </>
        }
      />

      <Button
        className='text-sm gap-1 px-2 relative'
        icon={<Plug size={20} />}
        iconPosition='right'
        label={connecting ? 'Conectando…' : 'Obtener credenciales'}
        type='border'
        disabled={connecting}
        onClick={connect}
      />
    </div>
  )
}
