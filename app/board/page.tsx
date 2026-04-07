'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Client, Tenant, Pass } from '@/lib/types'

const QrScannerModal = dynamic(() => import('@/components/QrScannerModal'), { ssr: false })

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
      <div
        className="h-2 rounded-full transition-all"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

function ClientCard({ client, threshold, color, onClick }: { client: Client; threshold: number; color: string; onClick: () => void }) {
  const dormant = !client.last_visit || (Date.now() - new Date(client.last_visit).getTime()) >= 21 * 86400000
  const hasReward = client.visits_count >= threshold
  const lastVisitStr = client.last_visit
    ? new Date(client.last_visit).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : 'Jamais'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl p-4 shadow-sm border-2 active:scale-95 transition-all ${hasReward ? 'border-yellow-400' : dormant ? 'border-red-100' : 'border-gray-100'}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-bold text-gray-900 text-base leading-tight">{client.name || client.phone}</div>
          {client.name && <div className="text-xs text-gray-400">{client.phone}</div>}
        </div>
        <div className="flex flex-col items-end gap-1">
          {hasReward && <span className="text-base">🎁</span>}
          <div className={`w-2.5 h-2.5 rounded-full ${dormant ? 'bg-red-400' : 'bg-green-400'}`} />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{client.visits_count} / {threshold} visites</span>
        <span>{lastVisitStr}</span>
      </div>
      <ProgressBar value={client.visits_count} max={threshold} color={hasReward ? '#f59e0b' : color} />
    </button>
  )
}

export default function BoardPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [threshold, setThreshold] = useState(10)
  const [loading, setLoading] = useState(true)

  const [visitModal, setVisitModal] = useState(false)
  const [visitPhone, setVisitPhone] = useState('')
  const [visitName, setVisitName] = useState('')
  const [visitMsg, setVisitMsg] = useState('')
  const [visitLoading, setVisitLoading] = useState(false)

  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const activeTenantId = localStorage.getItem('activeTenantId')
    let query = supabase.from('tenants').select('*').eq('owner_id', user.id)
    if (activeTenantId) query = query.eq('id', activeTenantId)
    const { data: t } = await query.single()
    if (!t) { router.push('/merchants'); return }
    setTenant(t)

    const { data: pass } = await supabase.from('passes').select('reward_threshold').eq('tenant_id', t.id).eq('type', 'fidelite').order('created_at').limit(1).single()
    if (pass) setThreshold(pass.reward_threshold)

    const { data: cls } = await supabase.from('clients').select('*').eq('tenant_id', t.id).order('last_visit', { ascending: false, nullsFirst: false })
    setClients(cls || [])
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  const recordVisit = async (clientOverride?: Client) => {
    if (!tenant) return
    const supabase = createClient()
    const phone = clientOverride ? clientOverride.phone : visitPhone.trim()
    if (!phone) return
    setVisitLoading(true)

    let { data: client } = await supabase.from('clients').select('*').eq('phone', phone).eq('tenant_id', tenant.id).single()
    if (!client) {
      const { data: nc } = await supabase.from('clients').insert({ phone, name: visitName.trim() || null, tenant_id: tenant.id, visits_count: 0 }).select().single()
      client = nc
    }
    if (!client) { setVisitLoading(false); return }

    const newCount = (client.visits_count || 0) + 1
    await supabase.from('visits').insert({ client_id: client.id, tenant_id: tenant.id })
    await supabase.from('clients').update({ visits_count: newCount, last_visit: new Date().toISOString() }).eq('id', client.id)

    const msg = newCount >= threshold ? `🎁 ${client.name || phone} a débloqué sa récompense ! (${newCount} visites)` : `✅ Visite #${newCount} — ${client.name || phone}`
    setVisitMsg(msg)
    setVisitPhone('')
    setVisitName('')
    setVisitModal(false)
    setSelectedClient(null)
    setTimeout(() => setVisitMsg(''), 4000)
    setVisitLoading(false)
    await load()
  }

  const handleScanResult = async (scannedPhone: string) => {
    setScannerOpen(false)
    if (!scannedPhone.trim()) return
    setVisitPhone(scannedPhone.trim())
    // Auto-record the visit
    if (!tenant) return
    setVisitLoading(true)
    const supabase = createClient()
    const phone = scannedPhone.trim()
    let { data: client } = await supabase.from('clients').select('*').eq('phone', phone).eq('tenant_id', tenant.id).single()
    if (!client) {
      const { data: nc } = await supabase.from('clients').insert({ phone, tenant_id: tenant.id, visits_count: 0 }).select().single()
      client = nc
    }
    if (!client) { setVisitLoading(false); return }
    const newCount = (client.visits_count || 0) + 1
    await supabase.from('visits').insert({ client_id: client.id, tenant_id: tenant.id })
    await supabase.from('clients').update({ visits_count: newCount, last_visit: new Date().toISOString() }).eq('id', client.id)
    const msg = newCount >= threshold ? `🎁 ${client.name || phone} a débloqué sa récompense ! (${newCount} visites)` : `✅ Visite #${newCount} — ${client.name || phone}`
    setVisitMsg(msg)
    setTimeout(() => setVisitMsg(''), 4000)
    setVisitLoading(false)
    await load()
  }

  const now = Date.now()
  const active = clients.filter(c => c.last_visit && (now - new Date(c.last_visit).getTime()) < 21 * 86400000)
  const dormant = clients.filter(c => !c.last_visit || (now - new Date(c.last_visit).getTime()) >= 21 * 86400000)
  const rewards = clients.filter(c => c.visits_count >= threshold)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-indigo-600">
      <div className="text-white text-xl font-bold animate-pulse">Fidelity Up</div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ background: tenant?.primary_color || '#6366f1' }} className="px-4 pt-10 pb-4 sticky top-0 z-40">
        <div className="max-w-lg mx-auto">
          <button onClick={() => router.push('/merchants')} className="text-white/60 text-sm flex items-center gap-1 mb-2">
            ‹ Commerces
          </button>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">{tenant?.name}</h1>
              <p className="text-white/60 text-xs">{clients.length} clients · {active.length} actifs · {rewards.length} récompenses</p>
            </div>
            <Link href="/board/passes" className="bg-white/20 text-white text-xs font-semibold px-3 py-2 rounded-xl">
              ⚡ Cartes
            </Link>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setScannerOpen(true)}
              className="bg-white/20 text-white rounded-2xl py-3.5 px-4 font-bold text-base active:scale-95 transition-all flex items-center gap-2"
            >
              📷
            </button>
            <button
              onClick={() => setVisitModal(true)}
              className="flex-1 bg-white rounded-2xl py-3.5 flex items-center justify-center gap-2 font-bold text-base active:scale-95 transition-all"
              style={{ color: tenant?.primary_color || '#6366f1' }}
            >
              <span className="text-xl">+</span> Enregistrer une visite
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {visitMsg && (
        <div className="mx-4 mt-3 bg-green-500 text-white px-4 py-3 rounded-2xl text-sm font-semibold shadow-lg max-w-lg mx-auto">
          {visitMsg}
        </div>
      )}

      {/* Board */}
      <div className="px-4 py-4 max-w-lg mx-auto space-y-5">
        {clients.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">👥</div>
            <h3 className="font-bold text-gray-900 mb-1">Aucun client encore</h3>
            <p className="text-gray-500 text-sm">Enregistrez une visite ou créez une carte Wallet</p>
            <div className="flex gap-3 justify-center mt-4">
              <button onClick={() => setVisitModal(true)} className="px-5 py-3 rounded-xl font-semibold text-white text-sm" style={{ background: tenant?.primary_color }}>
                + Visite
              </button>
              <Link href="/board/passes" className="px-5 py-3 rounded-xl font-semibold text-sm bg-white border-2 border-gray-200 text-gray-700">
                ⚡ Créer carte
              </Link>
            </div>
          </div>
        )}

        {rewards.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-yellow-500 font-bold text-sm">🎁 RÉCOMPENSES ({rewards.length})</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {rewards.map(c => (
                <ClientCard key={c.id} client={c} threshold={threshold} color={tenant?.primary_color || '#6366f1'} onClick={() => setSelectedClient(c)} />
              ))}
            </div>
          </section>
        )}

        {active.filter(c => c.visits_count < threshold).length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-green-700 font-bold text-sm">ACTIFS ({active.filter(c => c.visits_count < threshold).length})</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {active.filter(c => c.visits_count < threshold).map(c => (
                <ClientCard key={c.id} client={c} threshold={threshold} color={tenant?.primary_color || '#6366f1'} onClick={() => setSelectedClient(c)} />
              ))}
            </div>
          </section>
        )}

        {dormant.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-red-600 font-bold text-sm">DORMANTS — +21 jours ({dormant.length})</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {dormant.map(c => (
                <ClientCard key={c.id} client={c} threshold={threshold} color={tenant?.primary_color || '#6366f1'} onClick={() => setSelectedClient(c)} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Visit Modal */}
      {visitModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setVisitModal(false)}>
          <div className="bg-white w-full rounded-t-3xl p-6 max-w-lg mx-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h2 className="text-xl font-bold text-gray-900 mb-4">+ Enregistrer une visite</h2>
            <div className="space-y-3">
              <input
                type="tel"
                autoFocus
                value={visitPhone}
                onChange={e => setVisitPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && recordVisit()}
                placeholder="📱 Téléphone client *"
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-lg focus:outline-none focus:border-indigo-400"
              />
              <input
                type="text"
                value={visitName}
                onChange={e => setVisitName(e.target.value)}
                placeholder="Prénom (optionnel)"
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-400"
              />
              <button
                onClick={() => recordVisit()}
                disabled={visitLoading || !visitPhone.trim()}
                className="w-full py-4 rounded-2xl font-bold text-white text-lg disabled:opacity-40 active:scale-95 transition-all"
                style={{ background: tenant?.primary_color || '#6366f1' }}
              >
                {visitLoading ? 'Enregistrement...' : '✅ Confirmer la visite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {scannerOpen && (
        <QrScannerModal
          onResult={handleScanResult}
          onClose={() => setScannerOpen(false)}
          color={tenant?.primary_color || '#6366f1'}
        />
      )}

      {/* Client Detail Modal */}
      {selectedClient && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setSelectedClient(null)}>
          <div className="bg-white w-full rounded-t-3xl p-6 max-w-lg mx-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white" style={{ background: tenant?.primary_color }}>
                {(selectedClient.name || selectedClient.phone).charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-xl text-gray-900">{selectedClient.name || selectedClient.phone}</div>
                {selectedClient.name && <div className="text-gray-500 text-sm">{selectedClient.phone}</div>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-indigo-50 rounded-2xl p-3 text-center">
                <div className="font-bold text-2xl text-indigo-700">{selectedClient.visits_count}</div>
                <div className="text-xs text-indigo-400 mt-0.5">Visites</div>
              </div>
              <div className="bg-yellow-50 rounded-2xl p-3 text-center">
                <div className="font-bold text-2xl text-yellow-600">{Math.floor(selectedClient.visits_count / threshold)}</div>
                <div className="text-xs text-yellow-400 mt-0.5">Récompenses</div>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3 text-center">
                <div className="font-bold text-sm text-gray-700 mt-1">
                  {selectedClient.last_visit ? new Date(selectedClient.last_visit).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Jamais'}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Dernière visite</div>
              </div>
            </div>

            <div className="mb-5">
              <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
                <span>Progression fidélité</span>
                <span className="font-semibold">{selectedClient.visits_count % threshold} / {threshold}</span>
              </div>
              <ProgressBar value={selectedClient.visits_count % threshold} max={threshold} color={tenant?.primary_color || '#6366f1'} />
            </div>

            {visitMsg && <div className="bg-green-50 text-green-700 px-4 py-2 rounded-xl mb-3 text-sm font-medium">{visitMsg}</div>}

            <button
              onClick={() => recordVisit(selectedClient)}
              disabled={visitLoading}
              className="w-full py-4 rounded-2xl font-bold text-white text-lg disabled:opacity-40 active:scale-95 transition-all"
              style={{ background: tenant?.primary_color || '#6366f1' }}
            >
              {visitLoading ? '...' : '+ Enregistrer une visite'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
