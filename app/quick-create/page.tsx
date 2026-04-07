'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import type { Tenant, PassType } from '@/lib/types'

const PASS_TYPES: { value: PassType; label: string; emoji: string; desc: string }[] = [
  { value: 'fidelite', label: 'Carte Fidélité', emoji: '⭐', desc: '1 visite = 1 point' },
  { value: 'visite', label: 'Carte de Visite', emoji: '👤', desc: 'Coordonnées digitales' },
  { value: 'cadeau', label: 'Carte Cadeau', emoji: '🎁', desc: 'Offrir à vos clients' },
  { value: 'coupon', label: 'Coupon Promo', emoji: '🏷️', desc: 'Réduction immédiate' },
]

export default function QuickCreatePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ passId: string; installUrl: string; dbPassId: string } | null>(null)

  const [form, setForm] = useState({
    type: '' as PassType,
    reward_threshold: 10,
    reward_description: '',
  })

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('tenants').select('*').eq('owner_id', user.id).single()
      if (data) setTenant(data)
      else router.push('/onboarding')
    }
    load()
  }, [router])

  const PASS_LABELS: Record<PassType, string> = {
    fidelite: 'Carte Fidélité',
    visite: 'Carte de Visite Digitale',
    cadeau: 'Carte Cadeau',
    coupon: 'Coupon Promotionnel',
  }

  const generate = async () => {
    if (!tenant) return
    setLoading(true)
    setError('')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin

    const textModules = []
    if (form.type === 'fidelite') {
      textModules.push({
        id: 'reward',
        header: `Récompense à ${form.reward_threshold} visites`,
        body: form.reward_description || 'Récompense offerte',
      })
    }

    try {
      const res = await fetch('/api/passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardTitle: `${tenant.name} — ${PASS_LABELS[form.type]}`,
          header: tenant.name,
          hexBackgroundColor: tenant.primary_color,
          barcodeType: 'QR_CODE',
          barcodeValue: `${appUrl}/install/`,
          textModulesData: textModules,
          ...(tenant.logo_url && { logoUrl: tenant.logo_url }),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur génération')

      const supabase = createClient()
      const { data: pass, error: dbErr } = await supabase.from('passes').insert({
        type: form.type,
        name: PASS_LABELS[form.type],
        reward_threshold: form.reward_threshold,
        reward_description: form.reward_description || null,
        addtowallet_pass_id: data.passId,
        install_url: data.installUrl,
        qr_url: `${appUrl}/install/${data.passId}`,
        tenant_id: tenant.id,
      }).select().single()

      if (dbErr) throw new Error(dbErr.message)

      setResult({
        passId: data.passId,
        installUrl: data.installUrl,
        dbPassId: pass.id,
      })
      setStep(4)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || ''
  const installPageUrl = result ? `${appUrl}/install/${result.dbPassId}` : ''

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-600">
        <div className="text-white text-center animate-pulse">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div style={{ background: tenant.primary_color }} className="px-4 pt-10 pb-8">
        <div className="max-w-md mx-auto">
          <button onClick={() => router.push('/dashboard')} className="text-white/70 text-sm mb-4 flex items-center gap-1">
            ← Dashboard
          </button>
          <div className="flex gap-2 mb-4">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-white' : 'bg-white/30'}`} />
            ))}
          </div>
          <h1 className="text-2xl font-bold text-white">
            {step === 1 && '⚡ Création Rapide'}
            {step === 2 && 'Type de carte'}
            {step === 3 && 'Configurer la récompense'}
            {step === 4 && '✅ Carte créée !'}
          </h1>
          <p className="text-white/70 text-sm mt-1">{tenant.name}</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full">
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-gray-600 text-center mb-4">Créez une carte Wallet en moins de 2 minutes et générez un QR d&apos;installation immédiate.</p>
              <div className="grid grid-cols-2 gap-3 text-center text-sm">
                {[['⏱️', '< 2 min'], ['📱', 'Apple & Google Wallet'], ['📊', 'CRM auto'], ['🔔', 'Notifications']].map(([e, t]) => (
                  <div key={t} className="bg-indigo-50 rounded-xl p-3">
                    <div className="text-2xl mb-1">{e}</div>
                    <div className="text-indigo-700 font-medium text-xs">{t}</div>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full text-white py-4 rounded-xl font-semibold text-lg active:scale-95 transition-all"
              style={{ background: tenant.primary_color }}
            >
              Commencer ⚡
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {PASS_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => { setForm((f) => ({ ...f, type: t.value })); setStep(3) }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 bg-white text-left hover:border-indigo-300 active:scale-95 transition-all"
              >
                <span className="text-4xl">{t.emoji}</span>
                <div>
                  <div className="font-semibold text-gray-900">{t.label}</div>
                  <div className="text-gray-500 text-sm">{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {form.type === 'fidelite' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Visites pour récompense</label>
                  <div className="flex gap-2">
                    {[5, 8, 10, 15, 20].map((n) => (
                      <button
                        key={n}
                        onClick={() => setForm((f) => ({ ...f, reward_threshold: n }))}
                        className={`flex-1 py-3 rounded-xl font-bold text-lg border-2 transition-all ${form.reward_threshold === n ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-700'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Récompense offerte</label>
                  <input
                    type="text"
                    value={form.reward_description}
                    onChange={(e) => setForm((f) => ({ ...f, reward_description: e.target.value }))}
                    placeholder="Ex: 1 café offert, -20%, produit gratuit..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </>
            )}
            {form.type !== 'fidelite' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description de la carte</label>
                <input
                  type="text"
                  value={form.reward_description}
                  onChange={(e) => setForm((f) => ({ ...f, reward_description: e.target.value }))}
                  placeholder={form.type === 'cadeau' ? 'Valeur ou description...' : 'Offre ou réduction...'}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

            <button
              onClick={generate}
              disabled={loading}
              className="w-full text-white py-4 rounded-xl font-semibold text-lg disabled:opacity-60 active:scale-95 transition-all"
              style={{ background: tenant.primary_color }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Génération en cours...
                </span>
              ) : '🎉 Générer la carte Wallet'}
            </button>
          </div>
        )}

        {step === 4 && result && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
              <div className="text-green-500 text-5xl mb-3">✅</div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Carte créée !</h2>
              <p className="text-gray-500 text-sm mb-6">Faites scanner ce QR par votre client pour installer la carte</p>

              <div className="flex justify-center mb-4">
                <div className="p-4 bg-white rounded-2xl shadow-md border border-gray-100">
                  <QRCodeSVG
                    value={installPageUrl}
                    size={220}
                    level="H"
                    includeMargin
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 break-all">{installPageUrl}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <a
                href={result.installUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 bg-white border-2 border-gray-200 rounded-xl p-4 text-sm font-medium text-gray-700 active:scale-95 transition-all"
              >
                <span className="text-2xl">📱</span>
                Tester l&apos;install
              </a>
              <button
                onClick={() => { setStep(1); setForm({ type: '' as PassType, reward_threshold: 10, reward_description: '' }); setResult(null) }}
                className="flex flex-col items-center gap-2 bg-white border-2 border-gray-200 rounded-xl p-4 text-sm font-medium text-gray-700 active:scale-95 transition-all"
              >
                <span className="text-2xl">➕</span>
                Nouvelle carte
              </button>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full text-white py-4 rounded-xl font-semibold"
              style={{ background: tenant.primary_color }}
            >
              Voir le dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
