'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Client, Tenant } from '@/lib/types'

export default function ClientsPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Client | null>(null)
  const [visitMsg, setVisitMsg] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: t } = await supabase.from('tenants').select('*').eq('owner_id', user.id).single()
      if (!t) { router.push('/onboarding'); return }
      setTenant(t)
      const { data } = await supabase.from('clients').select('*').eq('tenant_id', t.id).order('last_visit', { ascending: false, nullsFirst: false })
      setClients(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  const recordVisit = async (client: Client) => {
    if (!tenant) return
    const supabase = createClient()
    await supabase.from('visits').insert({ client_id: client.id, tenant_id: tenant.id })
    const newCount = (client.visits_count || 0) + 1
    await supabase.from('clients').update({ visits_count: newCount, last_visit: new Date().toISOString() }).eq('id', client.id)
    setClients((prev) => prev.map((c) => c.id === client.id ? { ...c, visits_count: newCount, last_visit: new Date().toISOString() } : c))
    if (selected?.id === client.id) setSelected((s) => s ? { ...s, visits_count: newCount, last_visit: new Date().toISOString() } : s)
    setVisitMsg(`✅ Visite #${newCount} enregistrée`)
    setTimeout(() => setVisitMsg(''), 2500)
  }

  const filtered = clients.filter((c) =>
    (c.phone || '').includes(search) || (c.name || '').toLowerCase().includes(search.toLowerCase())
  )

  const isDormant = (c: Client) => !c.last_visit || (Date.now() - new Date(c.last_visit).getTime()) >= 21 * 86400000

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-400 animate-pulse">Chargement...</div></div>

  return (
    <div>
      <div style={{ background: tenant?.primary_color || '#6366f1' }} className="px-4 pt-12 pb-6">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-white mb-4">👥 Clients</h1>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou téléphone..."
            className="w-full bg-white/20 text-white placeholder-white/60 rounded-xl px-4 py-3 outline-none focus:bg-white/30 transition-all"
          />
          <div className="flex gap-4 mt-3 text-white/80 text-sm">
            <span>🟢 {clients.filter(c => !isDormant(c)).length} actifs</span>
            <span>🔴 {clients.filter(c => isDormant(c)).length} dormants</span>
            <span>👥 {clients.length} total</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-md mx-auto">
        {visitMsg && (
          <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm font-medium">{visitMsg}</div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">👤</div>
            <p className="text-gray-500">Aucun client trouvé</p>
            <p className="text-gray-400 text-sm mt-1">Les clients apparaissent après installation d&apos;une carte</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => {
              const dormant = isDormant(c)
              const lastVisitStr = c.last_visit ? new Date(c.last_visit).toLocaleDateString('fr-FR') : 'Jamais'
              return (
                <div
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:scale-98 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${dormant ? 'bg-red-400' : 'bg-green-400'}`} />
                      <div>
                        <div className="font-semibold text-gray-900">{c.name || c.phone}</div>
                        {c.name && <div className="text-xs text-gray-500">{c.phone}</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-indigo-600">{c.visits_count}</div>
                      <div className="text-xs text-gray-400">visites</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                    <span>Dernière visite : {lastVisitStr}</span>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${dormant ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                      {dormant ? 'Dormant' : 'Actif'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setSelected(null)}>
          <div className="bg-white w-full rounded-t-3xl p-6 max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${isDormant(selected) ? 'bg-red-100' : 'bg-green-100'}`}>
                {selected.name ? selected.name.charAt(0).toUpperCase() : '👤'}
              </div>
              <div>
                <div className="font-bold text-xl text-gray-900">{selected.name || selected.phone}</div>
                {selected.name && <div className="text-gray-500">{selected.phone}</div>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-indigo-50 rounded-xl p-3 text-center">
                <div className="font-bold text-2xl text-indigo-700">{selected.visits_count}</div>
                <div className="text-xs text-indigo-500">Visites</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <div className="font-bold text-2xl text-purple-700">{selected.reward_level}</div>
                <div className="text-xs text-purple-500">Rewards</div>
              </div>
              <div className={`rounded-xl p-3 text-center ${isDormant(selected) ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className={`font-bold text-sm ${isDormant(selected) ? 'text-red-700' : 'text-green-700'}`}>
                  {isDormant(selected) ? '🔴' : '🟢'}
                </div>
                <div className={`text-xs ${isDormant(selected) ? 'text-red-500' : 'text-green-500'}`}>
                  {isDormant(selected) ? 'Dormant' : 'Actif'}
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-500 mb-4">
              Dernière visite : {selected.last_visit ? new Date(selected.last_visit).toLocaleDateString('fr-FR') : 'Jamais'}
            </div>

            {visitMsg && <div className="bg-green-50 text-green-700 px-4 py-2 rounded-xl mb-3 text-sm">{visitMsg}</div>}

            <button
              onClick={() => recordVisit(selected)}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-base active:scale-95 transition-all"
            >
              +1 Visite
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
