'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Tenant } from '@/lib/types'

const TYPE_EMOJIS: Record<string, string> = {
  restaurant: '🍽️', barber: '✂️', retail: '🛍️', garage: '🚗', autre: '🏪',
}

interface TenantCard extends Tenant {
  clientCount: number
}

export default function MerchantsPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<TenantCard[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setEmail(user.email || '')
      if (user.email === 'info@14level-up.ch') setIsSuperAdmin(true)

      const { data: ts } = await supabase.from('tenants').select('*').eq('owner_id', user.id).order('created_at', { ascending: false })
      if (!ts || ts.length === 0) { setLoading(false); return }

      const enriched = await Promise.all(ts.map(async (t) => {
        const { count } = await supabase.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id)
        return { ...t, clientCount: count || 0 }
      }))

      setTenants(enriched)
      setLoading(false)
    }
    load()
  }, [router])

  const select = (id: string) => {
    localStorage.setItem('activeTenantId', id)
    router.push('/board')
  }

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div className="min-h-screen bg-indigo-600 flex items-center justify-center">
      <div className="text-white text-xl font-bold animate-pulse">Fidelity Up</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-indigo-600 px-4 pt-12 pb-8">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">💳 Fidelity Up</h1>
            <p className="text-indigo-200 text-sm">{email}</p>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <Link href="/admin" className="text-yellow-300 text-sm border border-yellow-400/50 rounded-xl px-3 py-1.5 font-semibold">
                🔑 Admin
              </Link>
            )}
            <button onClick={logout} className="text-indigo-200 text-sm border border-indigo-400 rounded-xl px-3 py-1.5">
              Déco
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Mes commerces ({tenants.length})</p>

        {tenants.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">🏪</div>
            <h3 className="font-bold text-gray-900 mb-1">Aucun commerce encore</h3>
            <p className="text-gray-500 text-sm mb-5">Créez votre premier commerce pour commencer</p>
          </div>
        ) : (
          tenants.map((t) => (
            <button
              key={t.id}
              onClick={() => select(t.id)}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 active:scale-98 transition-all text-left"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: t.primary_color + '22', border: `2px solid ${t.primary_color}33` }}
              >
                {TYPE_EMOJIS[t.type] || '🏪'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-900 text-base truncate">{t.name}</div>
                <div className="text-sm text-gray-500 capitalize">{t.type}</div>
                <div className="text-xs text-gray-400 mt-0.5">{t.clientCount} client{t.clientCount !== 1 ? 's' : ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: t.primary_color }} />
                <span className="text-gray-300 text-xl">›</span>
              </div>
            </button>
          ))
        )}

        <Link
          href="/setup"
          className="w-full flex items-center justify-center gap-3 border-2 border-dashed border-indigo-300 rounded-2xl p-4 text-indigo-600 font-bold active:scale-98 transition-all bg-indigo-50"
        >
          <span className="text-xl">+</span> Nouveau commerce
        </Link>
      </div>
    </div>
  )
}
