'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase'
import type { Pass, Tenant } from '@/lib/types'

export default function InstallPage() {
  const params = useParams()
  const passId = params.passId as string

  const [pass, setPass] = useState<Pass | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'install' | 'register' | 'success'>('install')

  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const TYPE_LABELS: Record<string, string> = {
    fidelite: 'Carte Fidélité',
    visite: 'Carte de Visite',
    cadeau: 'Carte Cadeau',
    coupon: 'Coupon Promo',
  }

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
    if (!phone.trim() || !pass || !tenant) return
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

    const { error: err } = await supabase.from('clients').insert({
      phone: phone.trim(),
      name: name.trim() || null,
      tenant_id: tenant.id,
      wallet_pass_id: pass.addtowallet_pass_id,
      visits_count: 0,
    })

    if (err) {
      setError('Erreur lors de la création du profil')
      setSaving(false)
      return
    }

    setStep('success')
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-600">
        <div className="text-white animate-pulse text-lg">Chargement...</div>
      </div>
    )
  }

  if (!pass || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-6">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-900">Carte introuvable</h1>
          <p className="text-gray-500 mt-2">Ce lien n&apos;est plus valide</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: tenant.primary_color }}>
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-6xl mb-3">💳</div>
            <h1 className="text-3xl font-bold text-white">{tenant.name}</h1>
            <p className="text-white/70 mt-1">{TYPE_LABELS[pass.type] || pass.type}</p>
            {pass.reward_description && (
              <div className="mt-3 bg-white/20 rounded-2xl px-4 py-3 text-white text-sm">
                {pass.type === 'fidelite' ? `🎁 ${pass.reward_description} après ${pass.reward_threshold} visites` : pass.reward_description}
              </div>
            )}
          </div>

          {step === 'install' && (
            <div className="space-y-4">
              {pass.install_url && (
                <a
                  href={pass.install_url}
                  className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 py-5 rounded-2xl font-bold text-lg shadow-xl active:scale-95 transition-all"
                >
                  <span className="text-2xl">📱</span>
                  Ajouter à mon Wallet
                </a>
              )}
              <button
                onClick={() => setStep('register')}
                className="w-full border-2 border-white/40 text-white py-4 rounded-2xl font-semibold active:scale-95 transition-all"
              >
                📝 Créer mon profil fidélité
              </button>
              <p className="text-center text-white/50 text-xs">Sans app requise · Apple Wallet & Google Wallet</p>
            </div>
          )}

          {step === 'register' && (
            <div className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Mon profil fidélité</h2>
                <p className="text-gray-500 text-sm">Créez votre compte pour accumuler vos points</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
                <input
                  type="tel"
                  autoFocus
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+33 6 00 00 00 00"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom (optionnel)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre prénom"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

              <button
                onClick={register}
                disabled={saving || !phone.trim()}
                className="w-full py-4 rounded-xl font-bold text-white text-base disabled:opacity-50 active:scale-95 transition-all"
                style={{ background: tenant.primary_color }}
              >
                {saving ? 'Création...' : '🎉 Rejoindre le programme'}
              </button>
              <button onClick={() => setStep('install')} className="w-full text-gray-400 text-sm py-2">
                ← Retour
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="bg-white rounded-2xl p-6 shadow-xl text-center space-y-4">
              <div className="text-5xl">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900">Bienvenue !</h2>
              <p className="text-gray-500">Votre profil fidélité est créé chez <strong>{tenant.name}</strong></p>
              {pass.reward_description && (
                <div className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-700">
                  🎁 Récompense : <strong>{pass.reward_description}</strong>
                  {pass.type === 'fidelite' && ` après ${pass.reward_threshold} visites`}
                </div>
              )}

              {/* Personal QR code for the merchant to scan */}
              <div className="border-t pt-4">
                <p className="text-xs text-gray-400 mb-3">Montrez ce QR au commerçant à chaque visite</p>
                <div className="flex justify-center">
                  <div className="p-3 bg-white rounded-2xl shadow border border-gray-100">
                    <QRCodeSVG value={phone} size={160} level="M" includeMargin />
                  </div>
                </div>
                <p className="text-xs text-gray-300 mt-2">{phone}</p>
              </div>

              {pass.install_url && (
                <a
                  href={pass.install_url}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white text-base active:scale-95 transition-all"
                  style={{ background: tenant.primary_color }}
                >
                  📱 Installer la carte Wallet
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
