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

const PRESET_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#1f2937']
const THRESHOLDS = [5, 8, 10, 15, 20]

export default function SetupPage() {
  const router = useRouter()

  // Step
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 — Commerce info
  const [name, setName] = useState('')
  const [type, setType] = useState<TenantType>('' as TenantType)
  const [color, setColor] = useState('#6366f1')

  // Step 2 — Loyalty programme
  const [threshold, setThreshold] = useState(10)
  const [rewardDesc, setRewardDesc] = useState('')
  const [dailyCustomers, setDailyCustomers] = useState('')
  const [staffSize, setStaffSize] = useState('')
  const [hasUbereats, setHasUbereats] = useState(false)
  const [hasWhatsapp, setHasWhatsapp] = useState(false)

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Step 1 → Step 2 ──────────────────────────────────────────────────────
  const goToStep2 = () => {
    if (!name.trim() || !type) return
    setError('')
    setStep(2)
  }

  // ── Final submit ──────────────────────────────────────────────────────────
  const submit = async () => {
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // 1. Create tenant
      const slug = slugify(name) + '-' + Math.random().toString(36).slice(2, 6)
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert({
          name: name.trim(),
          type,
          primary_color: color,
          email: user.email,
          slug,
          owner_id: user.id,
        })
        .select('id')
        .single()

      if (tenantErr) throw new Error(tenantErr.message)
      const tenantId = tenant.id

      // 2. Create tenant_profile (optional CRM data)
      await supabase.from('tenant_profiles').insert({
        tenant_id: tenantId,
        daily_customers: dailyCustomers ? parseInt(dailyCustomers) : null,
        staff_size: staffSize ? parseInt(staffSize) : null,
        has_ubereats: hasUbereats,
        has_whatsapp: hasWhatsapp,
      })

      // 3. Enable loyalty module
      await supabase.from('tenant_modules').insert({
        tenant_id: tenantId,
        module: 'loyalty',
        enabled: true,
      })

      // 4. Generate wallet pass
      const origin = window.location.origin
      const passRes = await fetch('/api/passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardTitle: `${name.trim()} — Carte Fidélité`,
          header: name.trim(),
          hexBackgroundColor: color,
          barcodeType: 'QR_CODE',
          barcodeValue: `${origin}/install/`,
          textModulesData: rewardDesc
            ? [{ id: 'reward', header: `Récompense après ${threshold} visites`, body: rewardDesc }]
            : [],
        }),
      })

      if (!passRes.ok) {
        const body = await passRes.text()
        throw new Error(`Erreur génération carte: ${body}`)
      }

      const passData = await passRes.json()

      // 5. Save pass record
      await supabase.from('passes').insert({
        type: 'fidelite',
        name: 'Carte Fidélité',
        reward_threshold: threshold,
        reward_description: rewardDesc || null,
        addtowallet_pass_id: passData.passId,
        install_url: passData.installUrl,
        qr_url: `${origin}/install/${passData.passId}`,
        tenant_id: tenantId,
      })

      // 6. Set active tenant and navigate
      localStorage.setItem('activeTenantId', tenantId)
      router.push('/board')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: color }}>
      <div className="flex-1 flex flex-col justify-end px-4 pb-6">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="text-6xl mb-3">💳</div>
          <h1 className="text-3xl font-bold text-white">Fidelity Up</h1>
          <p className="text-white/70 mt-1">
            {step === 1 ? 'Configurez votre commerce en 30 secondes' : 'Paramétrez votre programme fidélité'}
          </p>
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="bg-white rounded-3xl p-6 space-y-5 shadow-2xl">

            {/* Nom du commerce */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nom du commerce <span className="text-red-400">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Barber Club, Chez Mario..."
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-lg font-medium focus:outline-none focus:border-indigo-400 transition-colors"
              />
            </div>

            {/* Type de commerce */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type de commerce</label>
              <div className="grid grid-cols-5 gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                      type === t.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-white'
                    }`}
                  >
                    <span className="text-2xl">{t.emoji}</span>
                    <span className="text-xs font-medium text-gray-600 leading-tight text-center">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Couleur */}
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
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        color === c ? 'border-gray-800 scale-110' : 'border-transparent'
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

            <button
              onClick={goToStep2}
              disabled={!name.trim() || !type}
              className="w-full py-4 rounded-2xl font-bold text-white text-lg disabled:opacity-40 active:scale-95 transition-all"
              style={{ background: color }}
            >
              Suivant →
            </button>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="bg-white rounded-3xl p-6 space-y-5 shadow-2xl">

            {/* Back link */}
            <button
              onClick={() => { setError(''); setStep(1) }}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
            >
              ← Retour
            </button>

            <h2 className="text-xl font-bold text-gray-800">🎯 Programme fidélité</h2>

            {/* Seuil */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre de visites avant récompense
              </label>
              <div className="flex gap-2">
                {THRESHOLDS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setThreshold(n)}
                    className={`flex-1 py-2 rounded-xl border-2 font-bold text-sm transition-all ${
                      threshold === n
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-100 text-gray-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Récompense */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Récompense offerte
              </label>
              <input
                type="text"
                value={rewardDesc}
                onChange={(e) => setRewardDesc(e.target.value)}
                placeholder="Ex: Café offert, -20%, Coupe gratuite..."
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-base font-medium focus:outline-none focus:border-indigo-400 transition-colors"
              />
            </div>

            {/* CRM section */}
            <div className="rounded-2xl border-2 border-gray-100 p-4 space-y-4">
              <p className="text-sm font-semibold text-gray-500">📊 Votre activité <span className="font-normal text-gray-400">(optionnel)</span></p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Clients / jour</label>
                  <input
                    type="number"
                    min="0"
                    value={dailyCustomers}
                    onChange={(e) => setDailyCustomers(e.target.value)}
                    placeholder="Ex: 40"
                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nombre d'employés</label>
                  <input
                    type="number"
                    min="0"
                    value={staffSize}
                    onChange={(e) => setStaffSize(e.target.value)}
                    placeholder="Ex: 3"
                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setHasUbereats(!hasUbereats)}
                    className={`w-10 h-6 rounded-full transition-colors relative ${hasUbereats ? 'bg-indigo-500' : 'bg-gray-200'}`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${hasUbereats ? 'translate-x-5' : 'translate-x-1'}`}
                    />
                  </div>
                  <span className="text-sm text-gray-600">UberEats</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setHasWhatsapp(!hasWhatsapp)}
                    className={`w-10 h-6 rounded-full transition-colors relative ${hasWhatsapp ? 'bg-indigo-500' : 'bg-gray-200'}`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${hasWhatsapp ? 'translate-x-5' : 'translate-x-1'}`}
                    />
                  </div>
                  <span className="text-sm text-gray-600">WhatsApp</span>
                </label>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-white text-lg disabled:opacity-60 active:scale-95 transition-all flex items-center justify-center gap-2"
              style={{ background: color }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Génération de votre carte...
                </>
              ) : (
                '🚀 Créer et générer ma carte'
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
