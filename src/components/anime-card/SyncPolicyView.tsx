import SyncPolicyForm from '@/components/sync-policy/SyncPolicyForm'
import { useAnimeStore } from './useAnimeStore'

export default function SyncPolicyView() {
  const setView = useAnimeStore(s => s.setView)
  const id = useAnimeStore(s => s.id)
  return <SyncPolicyForm malId={id} onBack={() => setView('linked')} />
}
