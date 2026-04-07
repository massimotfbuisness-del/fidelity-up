'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, slugify } from '@/lib/supabase'
import type { TenantType } from '@/lib/types'

const TYPES: { value: TenantType; label: string; emoji: string }[] = [
  { value: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
  { value: 'barber', label: 'Barbier / Salon', emoji: '✂️' },
  { value: 'retail', label: 'Commerce / Boutique', emoji: '🛍️' },
  { value: 'garage', label: 'Garage / Auto', emoji: '🚗' },
  { value: 'autre', label: 'Autre commerce', emoji: '🏪' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    type: '' as TenantType,
    primary_color: '#6366f1',
    address: '',
    phone: '',
    email: '',
  })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const slug = slugify(form.name) + '-' + Math.random().toString(36).slice(2, 6)

    const { error: err } = await supabase.from('tenants').insert({
      name: form.name,
      type: form.type,
      primary_color: form.primary_color,
      address: form.address || null,
      phone: form.phone || null,
      email: form.email || user.email,
      slug,
      owner_id: user.id,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    router.push('/quick-create')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-indigo-600 px-4 pt-12 pb-8">
        <div className="max-w-md mx-auto">
          <div className="flex gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-white' : 'bg-indigo-400'}`} />
            ))}
          </div>
          <h1 className="text-2xl font-bold text-white">
            {step === 1 && 'Votre commerce'}
            {step === 2 && 'Type de commerce'}
            {step === 3 && 'Contact & couleur'}
          </h1>
          <p className="text-indigo-200 text-sm mt-1">
            Étape {step} sur 3 — moins de 2 minutes
          </p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du commerce *</label>
              <input
                autoFocus
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Ex: Chez Mario, Barber Club..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={() => form.name.trim() && setStep(2)}
              disabled={!form.name.trim()}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-lg disabled:opacity-40 active:scale-95 transition-all"
            >
              Continuer →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => { set('type', t.value); setStep(3) }}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all active:scale-95 ${form.type === t.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'}`}
              >
                <span className="text-3xl">{t.emoji}</span>
                <span className="font-semibold text-gray-900">{t.label}</span>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+33 6 00 00 00 00"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email manager</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="manager@commerce.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Couleur principale</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => set('primary_color', e.target.value)}
                  className="w-14 h-14 rounded-xl border-2 border-gray-200 cursor-pointer p-1"
                />
                <span className="text-gray-500 text-sm">Couleur de vos cartes Wallet</span>
              </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

            <button
              onClick={submit}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-lg disabled:opacity-60 active:scale-95 transition-all"
            >
              {loading ? 'Création...' : '🚀 Créer mon commerce'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
