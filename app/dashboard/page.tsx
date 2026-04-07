'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Tenant, Client } from '@/lib/types'

interface Stats {
  totalPasses: number
  totalClients: number
  totalVisits: number
  activeClients: number
  dormantClients: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [stats, setStats] = useState<Stats>({ totalPasses: 0, totalClients: 0, totalVisits: 0, activeClients: 0, dormantClients: 0 })
  const [recentClients, setRecentClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [visitPhone, setVisitPhone] = useState('')
  const [visitMsg, setVisitMsg] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: t } = await supabase.from('tenants').select('*').eq('owner_id', user.id).single()
      if (!t) { router.push('/onboarding'); return }
      setTenant(t)

      const [passesRes, clientsRes, visitsRes] = await Promise.all([
        supabase.from('passes').select('id', { count: 'exact' }).eq('tenant_id', t.id),
        supabase.from('clients').select('*').eq('tenant_id', t.id).order('created_at', { ascending: false }),
        supabase.from('visits').select('id', { count: 'exact' }).eq('tenant_id', t.id),
      ])

      const clients: Client[] = clientsRes.data || []
      const now = new Date()
      const active = clients.filter(c => c.last_visit && (now.getTime() - new Date(c.last_visit).getTime()) < 21 * 86400000)
      const dormant = clients.filter(c => !c.last_visit || (now.getTime() - new Date(c.last_visit).getTime()) >= 21 * 86400000)

      setStats({
        totalPasses: passesRes.count || 0,
        totalClients: clients.length,
        totalVisits: visitsRes.count || 0,
        activeClients: active.length,
        dormantClients: dormant.length,
      })
      setRecentClients(clients.slice(0, 5))
      setLoading(false)
    }
    load()
  }, [router])

  const recordVisit = async () => {
    if (!visitPhone.trim() || !tenant) return
    const supabase = createClient()
    const phone = visitPhone.trim()

    let { data: client } = await supabase.from('clients').select('*').eq('phone', phone).eq('tenant_id', tenant.id).single()

    if (!client) {
      const { data: newClient } = await supabase.from('clients').insert({ phone, tenant_id: tenant.id, visits_count: 0 }).select().single()
      client = newClient
    }

    if (!client) { setVisitMsg('Erreur client'); return }

    await supabase.from('visits').insert({ client_id: client.id, tenant_id: tenant.id })
    const newCount = (client.visits_count || 0) + 1
    await supabase.from('clients').update({ visits_count: newCount, last_visit: new Date().toISOString() }).eq('id', client.id)

    setVisitMsg(`✅ Visite #${newCount} enregistrée pour ${phone}`)
    setVisitPhone('')
    setTimeout(() => setVisitMsg(''), 3000)

    const { data: t } = await supabase.from('tenants').select('*').eq('id', tenant.id).single()
    if (t) setTenant(t)
  }

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-600">
        <div className="text-white text-center animate-pulse">Chargement...</div>
      </div>
    )
  }

  const STAT_CARDS = [
    { label: 'Cartes créées', value: stats.totalPasses, emoji: '💳', color: 'bg-indigo-50 text-indigo-700' },
    { label: 'Clients', value: stats.totalClients, emoji: '👥', color: 'bg-green-50 text-green-700' },
    { label: 'Visites totales', value: stats.totalVisits, emoji: '📅', color: 'bg-blue-50 text-blue-700' },
    { label: 'Actifs', value: stats.activeClients, emoji: '🟢', color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Dormants', value: stats.dormantClients, emoji: '🔴', color: 'bg-red-50 text-red-700' },
    { label: 'Taux fidélité', value: stats.totalClients > 0 ? `${Math.round((stats.activeClients / stats.totalClients) * 100)}%` : '—', emoji: '📈', color: 'bg-purple-50 text-purple-700' },
  ]

  return (
    <div>
      <div style={{ background: tenant?.primary_color || '#6366f1' }} className="px-4 pt-12 pb-6">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">{tenant?.name}</h1>
              <p className="text-white/70 text-sm capitalize">{tenant?.type}</p>
            </div>
            <button onClick={logout} className="text-white/60 text-sm border border-white/30 rounded-xl px-3 py-1.5">
              Déco
            </button>
          </div>

          <div className="bg-white/10 rounded-2xl p-4 flex gap-3">
            <input
              type="tel"
              value={visitPhone}
              onChange={(e) => setVisitPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && recordVisit()}
              placeholder="📱 Téléphone client..."
              className="flex-1 bg-transparent text-white placeholder-white/50 outline-none text-base"
            />
            <button
              onClick={recordVisit}
              className="bg-white text-indigo-700 font-bold px-4 py-2 rounded-xl text-sm active:scale-95 transition-all"
            >
              +1 Visite
            </button>
          </div>
          {visitMsg && <div className="mt-2 text-white/90 text-sm">{visitMsg}</div>}
        </div>
      </div>

      <div className="px-4 py-6 max-w-md mx-auto space-y-6">
        <div className="grid grid-cols-3 gap-3">
          {STAT_CARDS.map((s) => (
            <div key={s.label} className={`${s.color} rounded-2xl p-3 text-center`}>
              <div className="text-xl mb-1">{s.emoji}</div>
              <div className="font-bold text-xl leading-tight">{s.value}</div>
              <div className="text-xs mt-0.5 opacity-80">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/quick-create"
            className="flex flex-col items-center gap-2 bg-indigo-600 text-white rounded-2xl p-5 active:scale-95 transition-all shadow-lg shadow-indigo-200"
          >
            <span className="text-3xl">⚡</span>
            <span className="font-semibold text-sm text-center">Créer une carte</span>
          </Link>
          <Link
            href="/dashboard/clients"
            className="flex flex-col items-center gap-2 bg-white border-2 border-gray-100 rounded-2xl p-5 text-gray-700 active:scale-95 transition-all"
          >
            <span className="text-3xl">👥</span>
            <span className="font-semibold text-sm text-center">Voir les clients</span>
          </Link>
        </div>

        {recentClients.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Clients récents</h2>
              <Link href="/dashboard/clients" className="text-indigo-600 text-sm">Tous →</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {recentClients.map((c) => {
                const isDormant = !c.last_visit || (Date.now() - new Date(c.last_visit).getTime()) >= 21 * 86400000
                return (
                  <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{c.name || c.phone}</div>
                      <div className="text-xs text-gray-500">{c.visits_count} visite{c.visits_count !== 1 ? 's' : ''}</div>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full ${isDormant ? 'bg-red-400' : 'bg-green-400'}`} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {stats.totalPasses === 0 && (
          <div className="bg-indigo-50 rounded-2xl p-6 text-center border-2 border-dashed border-indigo-200">
            <div className="text-4xl mb-3">💳</div>
            <h3 className="font-semibold text-indigo-900 mb-1">Créez votre première carte</h3>
            <p className="text-indigo-600 text-sm mb-4">En moins de 2 minutes, devant votre client</p>
            <Link
              href="/quick-create"
              className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold text-sm active:scale-95 transition-all"
            >
              ⚡ Création rapide
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
