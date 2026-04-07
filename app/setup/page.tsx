'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, slugify } from '@/lib/supabase'
import type { TenantType } from '@/lib/types'

const TYPES: { value: TenantType; label: string; emoji: string }[] = [
  { value: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
  { value: 'barber', label: 'Barbier', emoji: '✂️' },
  { value: 'retail', label: 'Boutique', emoji: '🛍️' },
  { value: 'garage', label: 'Garage', emoji: '🚗' },
  { value: 'autre', label: 'Autre', emoji: '🏪' },
]

export default function SetupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [type, setType] = useState<TenantType>('' as TenantType)
  const [color, setColor] = useState('#6366f1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim() || !type) return
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const slug = slugify(name) + '-' + Math.random().toString(36).slice(2, 6)
    const { error: err } = await supabase.from('tenants').insert({
      name: name.trim(),
      type,
      primary_color: color,
      email: user.email,
      slug,
      owner_id: user.id,
    })

    if (err) { setError(err.message); setLoading(false); return }
    router.push('/merchants')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: color }}>
      <div className="flex-1 flex flex-col justify-end px-4 pb-6">
        <div className="mb-8 text-center">
          <div className="text-6xl mb-3">💳</div>
          <h1 className="text-3xl font-bold text-white">Fidelity Up</h1>
          <p className="text-white/70 mt-1">Configurez votre commerce en 30 secondes</p>
        </div>

        <div className="bg-white rounded-3xl p-6 space-y-5 shadow-2xl">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Nom de votre commerce</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Barber Club, Chez Mario..."
              className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-lg font-medium focus:outline-none focus:border-indigo-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Type de commerce</label>
            <div className="grid grid-cols-5 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${type === t.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-white'}`}
                >
                  <span className="text-2xl">{t.emoji}</span>
                  <span className="text-xs font-medium text-gray-600 leading-tight text-center">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Couleur de vos cartes</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-14 h-14 rounded-2xl border-2 border-gray-100 cursor-pointer p-1"
              />
              <div className="flex gap-2 flex-wrap">
                {['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#1f2937'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

          <button
            onClick={submit}
            disabled={loading || !name.trim() || !type}
            className="w-full py-4 rounded-2xl font-bold text-white text-lg disabled:opacity-40 active:scale-95 transition-all"
            style={{ background: color }}
          >
            {loading ? 'Création...' : '🚀 Lancer mon board'}
          </button>
        </div>
      </div>
    </div>
  )
}
