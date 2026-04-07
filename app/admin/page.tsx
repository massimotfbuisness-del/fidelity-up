'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Tenant } from '@/lib/types'

interface TenantWithStats extends Tenant {
  clientCount: number
  passCount: number
  visitCount: number
}

export default function AdminPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<TenantWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [totals, setTotals] = useState({ tenants: 0, clients: 0, passes: 0, visits: 0 })

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: allTenants } = await supabase.from('tenants').select('*').order('created_at', { ascending: false })
      if (!allTenants) { setLoading(false); return }

      const enriched: TenantWithStats[] = await Promise.all(
        allTenants.map(async (t) => {
          const [clients, passes, visits] = await Promise.all([
            supabase.from('clients').select('id', { count: 'exact' }).eq('tenant_id', t.id),
            supabase.from('passes').select('id', { count: 'exact' }).eq('tenant_id', t.id),
            supabase.from('visits').select('id', { count: 'exact' }).eq('tenant_id', t.id),
          ])
          return {
            ...t,
            clientCount: clients.count || 0,
            passCount: passes.count || 0,
            visitCount: visits.count || 0,
          }
        })
      )

      setTenants(enriched)
      setTotals({
        tenants: enriched.length,
        clients: enriched.reduce((s, t) => s + t.clientCount, 0),
        passes: enriched.reduce((s, t) => s + t.passCount, 0),
        visits: enriched.reduce((s, t) => s + t.visitCount, 0),
      })
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-indigo-600"><div className="text-white animate-pulse">Chargement...</div></div>

  const TYPE_EMOJIS: Record<string, string> = { restaurant: '🍽️', barber: '✂️', retail: '🛍️', garage: '🚗', autre: '🏪' }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-900 px-4 pt-12 pb-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-1">🔑 Admin Fidelity Up</h1>
          <p className="text-gray-400 text-sm">Vue super admin — tous les commerces</p>
          <div className="grid grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Commerces', value: totals.tenants, color: 'text-indigo-400' },
              { label: 'Clients', value: totals.clients, color: 'text-green-400' },
              { label: 'Cartes', value: totals.passes, color: 'text-blue-400' },
              { label: 'Visites', value: totals.visits, color: 'text-yellow-400' },
            ].map((s) => (
              <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
                <div className={`font-bold text-2xl ${s.color}`}>{s.value}</div>
                <div className="text-gray-400 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-3">
        {tenants.length === 0 ? (
          <div className="text-center py-16 text-gray-400">Aucun commerce enregistré</div>
        ) : (
          tenants.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold text-white"
                    style={{ background: t.primary_color }}
                  >
                    {TYPE_EMOJIS[t.type] || '🏪'}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-400 capitalize">{t.type} · {new Date(t.created_at).toLocaleDateString('fr-FR')}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">{t.email}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-indigo-50 rounded-xl py-2">
                  <div className="font-bold text-indigo-700">{t.passCount}</div>
                  <div className="text-xs text-indigo-400">Cartes</div>
                </div>
                <div className="bg-green-50 rounded-xl py-2">
                  <div className="font-bold text-green-700">{t.clientCount}</div>
                  <div className="text-xs text-green-400">Clients</div>
                </div>
                <div className="bg-blue-50 rounded-xl py-2">
                  <div className="font-bold text-blue-700">{t.visitCount}</div>
                  <div className="text-xs text-blue-400">Visites</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
