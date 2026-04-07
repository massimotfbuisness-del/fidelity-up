'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase'
import type { Pass, Tenant } from '@/lib/types'

const TYPE_LABELS: Record<string, string> = {
  fidelite: 'Carte Fidélité',
  visite: 'Carte de Visite',
  cadeau: 'Carte Cadeau',
  coupon: 'Coupon Promo',
}

export default function InstallPage() {
  const params = useParams()
  const passId = params.passId as string

  const [pass, setPass] = useState<Pass | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'install' | 'register' | 'success'>('install')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: p } = await supabase.from('passes').select('*').eq('id', passId).single()
      if (!p) { setLoading(false); return }
      setPass(p)
      const { data: t } = await supabase.from('tenants').select('*').eq('id', p.tenant_id).single()
      if (t) setTenant(t)
      setLoading(false)
    }
    load()
  }, [passId])

  const register = async () => {
    if (!phone.trim() || !name.trim() || !pass || !tenant) return
    setSaving(true)
    setError('')
    const supabase = createClient()

    const { data: existing } = await supabase
      .from('clients')
      .select('*')
      .eq('phone', phone.trim())
      .eq('tenant_id', tenant.id)
      .single()

    if (existing) {
      setStep('success')
      setSaving(false)
      return
    }

    const { error: insertErr } = await supabase.from('clients').insert({
      phone: phone.trim(),
      name: name.trim(),
      email: email.trim() || null,
      tenant_id: tenant.id,
      wallet_pass_id: pass.addtowallet_pass_id,
      visits_count: 0,
    })

    if (insertErr) {
      setError('Erreur lors de la création du profil')
      setSaving(false)
      return
    }

    await supabase.from('events').insert({
      type: 'client_created',
      tenant_id: tenant.id,
      entity_type: 'client',
      payload: {
        phone: phone.trim(),
        name: name.trim(),
        email: email.trim() || null,
      },
    })

    setStep('success')
    setSaving(false)
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#4f46e5' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-white/70 text-sm tracking-wide">Chargement…</p>
        </div>
      </div>
    )
  }

  /* ── Not found ── */
  if (!pass || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 max-w-xs">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-900">Carte introuvable</h1>
          <p className="text-gray-400 mt-2 text-sm">Ce lien n&apos;est plus valide</p>
        </div>
      </div>
    )
  }

  const brandBg = tenant.primary_color ?? '#4f46e5'
  const rewardLabel = pass.reward_description
    ? pass.type === 'fidelite'
      ? `🎁 ${pass.reward_description} après ${pass.reward_threshold} visites`
      : `🎁 ${pass.reward_description}`
    : null

  /* ── Hero header shared across install + success ── */
  const Hero = () => (
    <div className="text-center mb-8 px-2">
      {/* card icon with soft glow */}
      <div
        className="inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-5 shadow-2xl"
        style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}
      >
        <span className="text-5xl">💳</span>
      </div>
      <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
        {tenant.name}
      </h1>
      {/* card-type badge */}
      <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white/90 text-xs font-semibold px-3 py-1 rounded-full">
        {TYPE_LABELS[pass.type] ?? pass.type}
      </div>
      {/* reward pill */}
      {rewardLabel && (
        <div
          className="mt-4 mx-auto max-w-xs bg-white/15 border border-white/25 rounded-2xl px-4 py-3 text-white text-sm font-medium"
          style={{ backdropFilter: 'blur(6px)' }}
        >
          {rewardLabel}
        </div>
      )}
    </div>
  )

  /* ════════════════════════════════════════
     STEP: install
  ════════════════════════════════════════ */
  if (step === 'install') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: `linear-gradient(160deg, ${brandBg} 0%, ${brandBg}cc 100%)` }}
      >
        {/* subtle top glare */}
        <div
          className="absolute top-0 left-0 right-0 h-64 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(255,255,255,0.18) 0%, transparent 70%)' }}
          aria-hidden
        />

        <div className="w-full max-w-sm relative">
          <Hero />

          <div className="space-y-3">
            {/* Primary CTA */}
            {pass.install_url && (
              <a
                href={pass.install_url}
                className="w-full flex items-center justify-center gap-3 bg-white py-5 rounded-2xl font-bold text-lg shadow-2xl active:scale-95 transition-transform duration-150"
                style={{ color: brandBg }}
              >
                <span className="text-2xl">📱</span>
                Ajouter à mon Wallet
              </a>
            )}

            {/* Secondary CTA */}
            <button
              onClick={() => setStep('register')}
              className="w-full flex items-center justify-center gap-3 border-2 border-white/30 text-white py-4 rounded-2xl font-semibold text-base active:scale-95 transition-transform duration-150"
              style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(4px)' }}
            >
              <span className="text-xl">👤</span>
              Créer mon profil fidélité
            </button>

            <p className="text-center text-white/40 text-xs pt-1 tracking-wide">
              Sans app · Apple &amp; Google Wallet
            </p>
          </div>
        </div>
      </div>
    )
  }

  /* ════════════════════════════════════════
     STEP: register
  ════════════════════════════════════════ */
  if (step === 'register') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: `linear-gradient(160deg, ${brandBg} 0%, ${brandBg}cc 100%)` }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-64 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(255,255,255,0.15) 0%, transparent 70%)' }}
          aria-hidden
        />

        <div className="w-full max-w-sm relative">
          {/* Mini branding */}
          <div className="text-center mb-5">
            <span className="text-4xl">💳</span>
            <p className="text-white/80 font-semibold mt-1 text-sm">{tenant.name}</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-2xl space-y-5">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">Mon profil fidélité</h2>
              <p className="text-gray-400 text-sm mt-1">
                Accumulez vos points et recevez vos récompenses
              </p>
            </div>

            {/* Prénom * */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Prénom <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre prénom"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 transition-shadow"
                style={{ '--tw-ring-color': brandBg } as React.CSSProperties}
              />
            </div>

            {/* Téléphone * */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Téléphone <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33 6 00 00 00 00"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 transition-shadow"
                style={{ '--tw-ring-color': brandBg } as React.CSSProperties}
              />
            </div>

            {/* Email (optionnel) */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Email <span className="text-gray-300 font-normal normal-case">(optionnel)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 transition-shadow"
                style={{ '--tw-ring-color': brandBg } as React.CSSProperties}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                <span>⚠️</span>
                {error}
              </div>
            )}

            <button
              onClick={register}
              disabled={saving || !phone.trim() || !name.trim()}
              className="w-full py-4 rounded-xl font-bold text-white text-base disabled:opacity-40 active:scale-95 transition-all shadow-lg"
              style={{ background: brandBg }}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Création…
                </span>
              ) : (
                '🎉 Rejoindre le programme'
              )}
            </button>

            <button
              onClick={() => setStep('install')}
              className="w-full text-gray-400 text-sm py-1 hover:text-gray-600 transition-colors"
            >
              ← Retour
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ════════════════════════════════════════
     STEP: success
  ════════════════════════════════════════ */
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: `linear-gradient(160deg, ${brandBg} 0%, ${brandBg}cc 100%)` }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-64 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(255,255,255,0.15) 0%, transparent 70%)' }}
        aria-hidden
      />

      <div className="w-full max-w-sm relative">
        {/* Mini brand */}
        <div className="text-center mb-5">
          <p className="text-white/70 text-sm font-medium">{tenant.name}</p>
        </div>

        <div className="bg-white rounded-3xl p-7 shadow-2xl text-center space-y-5">
          {/* Welcome */}
          <div>
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-2xl font-extrabold text-gray-900 leading-tight">
              Bienvenue {name ? name : ''}!
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Votre profil fidélité est activé
            </p>
          </div>

          {/* Reward box */}
          {rewardLabel && (
            <div
              className="rounded-2xl px-4 py-4 text-sm font-medium text-left"
              style={{ background: `${brandBg}18`, color: brandBg }}
            >
              <p className="font-semibold text-base mb-0.5">Votre récompense</p>
              <p className="opacity-80">{rewardLabel}</p>
            </div>
          )}

          {/* QR code */}
          <div className="border-t border-gray-100 pt-5">
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Montrez ce QR au commerçant à chaque visite
            </p>
            <div className="flex justify-center">
              <div
                className="p-4 rounded-2xl shadow-md border border-gray-100"
                style={{ background: '#fff' }}
              >
                <QRCodeSVG value={phone} size={180} level="M" includeMargin />
              </div>
            </div>
            <p className="text-xs text-gray-300 mt-3 font-mono">{phone}</p>
          </div>

          {/* Wallet CTA */}
          {pass.install_url && (
            <a
              href={pass.install_url}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white text-base active:scale-95 transition-transform shadow-lg"
              style={{ background: brandBg }}
            >
              📱 Installer la carte Wallet
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
