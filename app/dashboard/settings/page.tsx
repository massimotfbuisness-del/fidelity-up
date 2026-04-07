'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Tenant, TenantProfile } from '@/lib/types'

export default function SettingsPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [profile, setProfile] = useState<Partial<TenantProfile>>({})
  const [form, setForm] = useState({ name: '', phone: '', address: '', primary_color: '#6366f1' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: t } = await supabase.from('tenants').select('*').eq('owner_id', user.id).single()
      if (!t) { router.push('/onboarding'); return }
      setTenant(t)
      setForm({ name: t.name, phone: t.phone || '', address: t.address || '', primary_color: t.primary_color })
      const { data: p } = await supabase.from('tenant_profile').select('*').eq('tenant_id', t.id).single()
      if (p) setProfile(p)
    }
    load()
  }, [router])

  const saveTenant = async () => {
    if (!tenant) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('tenants').update({ name: form.name, phone: form.phone || null, address: form.address || null, primary_color: form.primary_color }).eq('id', tenant.id)
    setTenant((t) => t ? { ...t, ...form } : t)
    setMsg('✅ Sauvegardé')
    setTimeout(() => setMsg(''), 2000)
    setSaving(false)
  }

  const saveProfile = async () => {
    if (!tenant) return
    setSaving(true)
    const supabase = createClient()
    const { data: existing } = await supabase.from('tenant_profile').select('id').eq('tenant_id', tenant.id).single()
    if (existing) {
      await supabase.from('tenant_profile').update({ ...profile, updated_at: new Date().toISOString() }).eq('tenant_id', tenant.id)
    } else {
      await supabase.from('tenant_profile').insert({ ...profile, tenant_id: tenant.id })
    }
    setMsg('✅ Profil sauvegardé')
    setTimeout(() => setMsg(''), 2000)
    setSaving(false)
  }

  const set = (k: string, v: string | boolean | number) => setForm((f) => ({ ...f, [k]: v }))
  const setP = (k: string, v: boolean | number) => setProfile((p) => ({ ...p, [k]: v }))

  if (!tenant) return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-400 animate-pulse">Chargement...</div></div>

  return (
    <div>
      <div style={{ background: tenant.primary_color }} className="px-4 pt-12 pb-6">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-white">⚙️ Paramètres</h1>
          <p className="text-white/70 text-sm">{tenant.name}</p>
        </div>
      </div>

      <div className="px-4 py-6 max-w-md mx-auto space-y-6">
        {msg && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm font-medium">{msg}</div>}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Infos commerce</h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input type="text" value={form.address} onChange={(e) => set('address', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Couleur principale</label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.primary_color} onChange={(e) => set('primary_color', e.target.value)} className="w-14 h-14 rounded-xl border-2 border-gray-200 cursor-pointer p-1" />
                <span className="text-sm text-gray-500">{form.primary_color}</span>
              </div>
            </div>
            <button onClick={saveTenant} disabled={saving} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold active:scale-95 transition-all disabled:opacity-60">
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Profil business</h2>
            <p className="text-xs text-gray-400">Aide à personnaliser les recommandations</p>
          </div>
          <div className="p-4 space-y-4">
            {[
              { key: 'has_ubereats', label: '🛵 UberEats / Deliveroo' },
              { key: 'has_whatsapp_orders', label: '💬 Commandes WhatsApp' },
              { key: 'has_reservation_system', label: '📅 Système de réservation' },
              { key: 'has_loyalty_today', label: '⭐ Programme fidélité actuel' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{label}</span>
                <button
                  onClick={() => setP(key, !(profile as Record<string, boolean>)[key])}
                  className={`w-12 h-6 rounded-full transition-colors ${(profile as Record<string, boolean>)[key] ? 'bg-indigo-600' : 'bg-gray-200'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${(profile as Record<string, boolean>)[key] ? 'translate-x-6' : ''}`} />
                </button>
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effectif (personnes)</label>
              <input type="number" value={profile.staff_size || ''} onChange={(e) => setP('staff_size', parseInt(e.target.value) || 0)} className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex: 3" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clients par jour (moy.)</label>
              <input type="number" value={profile.avg_daily_clients || ''} onChange={(e) => setP('avg_daily_clients', parseInt(e.target.value) || 0)} className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex: 30" />
            </div>
            <button onClick={saveProfile} disabled={saving} className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold active:scale-95 transition-all disabled:opacity-60">
              {saving ? 'Sauvegarde...' : 'Sauvegarder le profil'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
