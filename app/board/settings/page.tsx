'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Tenant } from '@/lib/types'

export default function BoardSettingsPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', address: '', primary_color: '#6366f1' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const activeTenantId = localStorage.getItem('activeTenantId')
      let tQuery = supabase.from('tenants').select('*').eq('owner_id', user.id)
      if (activeTenantId) tQuery = tQuery.eq('id', activeTenantId)
      const { data: t } = await tQuery.single()
      if (!t) { router.push('/merchants'); return }
      setTenant(t)
      setForm({ name: t.name, phone: t.phone || '', address: t.address || '', primary_color: t.primary_color })
    }
    load()
  }, [router])

  const save = async () => {
    if (!tenant) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('tenants').update({ name: form.name, phone: form.phone || null, address: form.address || null, primary_color: form.primary_color }).eq('id', tenant.id)
    setMsg('✅ Sauvegardé')
    setTimeout(() => setMsg(''), 2000)
    setSaving(false)
  }

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!tenant) return null

  return (
    <div>
      <div style={{ background: tenant.primary_color }} className="px-4 pt-10 pb-5">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-white">⚙️ Configuration</h1>
          <p className="text-white/60 text-xs">{tenant.name}</p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        {msg && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-2xl text-sm font-semibold">{msg}</div>}

        <div className="bg-white rounded-2xl p-5 space-y-4 shadow-sm">
          {[
            { key: 'name', label: 'Nom du commerce', type: 'text' },
            { key: 'phone', label: 'Téléphone', type: 'tel' },
            { key: 'address', label: 'Adresse', type: 'text' },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
              <input type={type} value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-400" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Couleur</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                className="w-12 h-12 rounded-xl border-2 border-gray-100 cursor-pointer p-1" />
              <div className="flex gap-2">
                {['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#1f2937'].map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, primary_color: c }))}
                    className={`w-7 h-7 rounded-full border-2 ${form.primary_color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
          <button onClick={save} disabled={saving} className="w-full py-3.5 rounded-xl font-bold text-white disabled:opacity-50 active:scale-95 transition-all" style={{ background: tenant.primary_color }}>
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>

        <button onClick={logout} className="w-full py-3.5 rounded-xl font-semibold text-red-500 bg-white border-2 border-red-100 active:scale-95 transition-all">
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
