'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Tenant } from '@/lib/types'

const SUPER_ADMIN_EMAIL = 'info@14level-up.ch'

const TYPE_CONFIG: Record<string, { emoji: string; label: string }> = {
  restaurant: { emoji: '🍽️', label: 'Restaurant' },
  barber:     { emoji: '✂️',  label: 'Barbier' },
  retail:     { emoji: '🛍️', label: 'Boutique' },
  garage:     { emoji: '🚗', label: 'Garage' },
  autre:      { emoji: '🏪', label: 'Autre' },
}

const FILTER_TYPES = ['Tous', 'Restaurant', 'Barbier', 'Boutique', 'Garage', 'Autre'] as const
type FilterType = (typeof FILTER_TYPES)[number]

const TYPE_KEY_MAP: Record<FilterType, string | null> = {
  Tous:       null,
  Restaurant: 'restaurant',
  Barbier:    'barber',
  Boutique:   'retail',
  Garage:     'garage',
  Autre:      'autre',
}

interface TenantWithStats extends Tenant {
  clientCount: number
  visitCount: number
  passCount: number
}

interface Totals {
  tenants: number
  clients: number
  visits: number
  passes: number
}

export default function SuperAdminPage() {
  const router = useRouter()

  const [tenants, setTenants]           = useState<TenantWithStats[]>([])
  const [loading, setLoading]           = useState(true)
  const [userEmail, setUserEmail]       = useState('')
  const [totals, setTotals]             = useState<Totals>({ tenants: 0, clients: 0, visits: 0, passes: 0 })
  const [search, setSearch]             = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('Tous')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()

      // ── Auth check ──────────────────────────────────────────────────────────
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setUserEmail(user.email ?? '')

      const isSuperAdminByEmail = user.email === SUPER_ADMIN_EMAIL

      if (!isSuperAdminByEmail) {
        const { data: memberRow } = await supabase
          .from('tenant_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'super_admin')
          .maybeSingle()

        if (!memberRow) {
          router.push('/merchants')
          return
        }
      }

      // ── Load all tenants ─────────────────────────────────────────────────────
      const { data: allTenants } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false })

      if (!allTenants || allTenants.length === 0) {
        setLoading(false)
        return
      }

      const tenantIds = allTenants.map((t) => t.id)

      // ── Bulk-fetch clients, visits, passes ───────────────────────────────────
      const [clientsRes, visitsRes, passesRes] = await Promise.all([
        supabase.from('clients').select('tenant_id').in('tenant_id', tenantIds),
        supabase.from('visits').select('tenant_id').in('tenant_id', tenantIds),
        supabase.from('passes').select('tenant_id').in('tenant_id', tenantIds),
      ])

      // Count by tenant_id in JS
      const countByTenant = (rows: { tenant_id: string }[] | null) =>
        (rows ?? []).reduce<Record<string, number>>((acc, row) => {
          acc[row.tenant_id] = (acc[row.tenant_id] ?? 0) + 1
          return acc
        }, {})

      const clientCounts = countByTenant(clientsRes.data)
      const visitCounts  = countByTenant(visitsRes.data)
      const passCounts   = countByTenant(passesRes.data)

      const enriched: TenantWithStats[] = allTenants.map((t) => ({
        ...t,
        clientCount: clientCounts[t.id] ?? 0,
        visitCount:  visitCounts[t.id]  ?? 0,
        passCount:   passCounts[t.id]   ?? 0,
      }))

      setTenants(enriched)
      setTotals({
        tenants: enriched.length,
        clients: enriched.reduce((s, t) => s + t.clientCount, 0),
        visits:  enriched.reduce((s, t) => s + t.visitCount,  0),
        passes:  enriched.reduce((s, t) => s + t.passCount,   0),
      })
      setLoading(false)
    }

    load()
  }, [router])

  // ── Logout ───────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Enter tenant ─────────────────────────────────────────────────────────────
  const handleEnter = (tenantId: string) => {
    localStorage.setItem('activeTenantId', tenantId)
    router.push('/board')
  }

  // ── Filter + search ───────────────────────────────────────────────────────────
  const filteredTenants = tenants.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const typeKey = TYPE_KEY_MAP[activeFilter]
    const matchesType = typeKey === null || t.type === typeKey
    return matchesSearch && matchesType
  })

  // ── Loading screen ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-700 gap-4">
        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        <p className="text-white/70 text-sm">Chargement du cockpit admin…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Header ── */}
      <header className="bg-gradient-to-b from-indigo-900 to-indigo-800 px-4 pt-12 pb-8 shadow-xl">
        <div className="max-w-2xl mx-auto">

          {/* Top row */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">🔑 Super Admin</h1>
              <p className="text-indigo-300 text-sm mt-0.5 truncate max-w-[220px]">{userEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 transition-colors px-3 py-2 rounded-xl text-white/80"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
              </svg>
              Déconnexion
            </button>
          </div>

          {/* Global stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Commerces', value: totals.tenants, color: 'from-indigo-500 to-indigo-400',  icon: '🏪' },
              { label: 'Clients',   value: totals.clients,  color: 'from-emerald-600 to-emerald-400', icon: '👥' },
              { label: 'Visites',   value: totals.visits,   color: 'from-amber-600 to-amber-400',    icon: '📍' },
              { label: 'Passes',    value: totals.passes,   color: 'from-sky-600 to-sky-400',        icon: '🎴' },
            ].map((s) => (
              <div
                key={s.label}
                className={`bg-gradient-to-br ${s.color} rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg`}
              >
                <span className="text-2xl mb-1">{s.icon}</span>
                <span className="text-3xl font-extrabold leading-none">{s.value}</span>
                <span className="text-xs text-white/75 mt-1 font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher un commerce…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Type filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {FILTER_TYPES.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                activeFilter === f
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/50'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Tenant count + new button */}
        <div className="flex items-center justify-between">
          <p className="text-gray-500 text-sm">
            {filteredTenants.length} commerce{filteredTenants.length !== 1 ? 's' : ''}
            {activeFilter !== 'Tous' && ` · ${activeFilter}`}
          </p>
          <Link
            href="/setup"
            className="flex items-center gap-1.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 transition-colors text-white px-4 py-2 rounded-xl shadow-lg shadow-indigo-900/40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nouveau commerce
          </Link>
        </div>

        {/* Tenant list */}
        {filteredTenants.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">🔍</p>
            <p className="text-gray-400 text-lg font-medium">Aucun résultat</p>
            <p className="text-gray-600 text-sm mt-1">Essayez un autre nom ou type</p>
          </div>
        ) : (
          <div className="space-y-3 pb-10">
            {filteredTenants.map((t) => {
              const cfg = TYPE_CONFIG[t.type] ?? { emoji: '🏪', label: t.type }
              return (
                <div
                  key={t.id}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-sm hover:border-indigo-700 transition-colors"
                >
                  {/* Card header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-md"
                      style={{ background: t.primary_color || '#6366f1' }}
                    >
                      {cfg.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-base leading-tight truncate">{t.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 font-medium">{cfg.label}</span>
                        <span className="w-1 h-1 bg-gray-700 rounded-full" />
                        {/* Primary color dot */}
                        <span
                          className="w-3 h-3 rounded-full border border-white/10 flex-shrink-0 shadow-sm"
                          style={{ background: t.primary_color || '#6366f1' }}
                          title={t.primary_color}
                        />
                        <span className="text-xs text-gray-600 font-mono">{t.primary_color}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-gray-800 rounded-xl py-2.5 text-center">
                      <div className="font-bold text-emerald-400 text-lg leading-none">{t.clientCount}</div>
                      <div className="text-xs text-gray-600 mt-0.5">Clients</div>
                    </div>
                    <div className="bg-gray-800 rounded-xl py-2.5 text-center">
                      <div className="font-bold text-amber-400 text-lg leading-none">{t.visitCount}</div>
                      <div className="text-xs text-gray-600 mt-0.5">Visites</div>
                    </div>
                    <div className="bg-gray-800 rounded-xl py-2.5 text-center">
                      <div className="font-bold text-sky-400 text-lg leading-none">{t.passCount}</div>
                      <div className="text-xs text-gray-600 mt-0.5">Passes</div>
                    </div>
                  </div>

                  {/* Footer: email + enter button */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 truncate max-w-[160px]">{t.email}</span>
                    <button
                      onClick={() => handleEnter(t.id)}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-md shadow-indigo-900/40"
                    >
                      Entrer
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
