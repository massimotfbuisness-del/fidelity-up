'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase'
import type { Tenant, Pass, PassType } from '@/lib/types'

const PASS_TYPES = [
  { value: 'fidelite' as PassType, label: 'Carte Fidélité', emoji: '⭐', desc: '1 visite = 1 point vers récompense' },
  { value: 'visite' as PassType, label: 'Carte de Visite', emoji: '👤', desc: 'Vos coordonnées digitales' },
  { value: 'cadeau' as PassType, label: 'Carte Cadeau', emoji: '🎁', desc: 'Offrir à vos clients' },
  { value: 'coupon' as PassType, label: 'Coupon Promo', emoji: '🏷️', desc: 'Réduction immédiate' },
]

const TYPE_LABELS: Record<string, string> = { fidelite: '⭐ Fidélité', visite: '👤 Visite', cadeau: '🎁 Cadeau', coupon: '🏷️ Coupon' }

export default function PassesPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [passes, setPasses] = useState<Pass[]>([])
  const [loading, setLoading] = useState(true)

  const [creating, setCreating] = useState(false)
  const [step, setStep] = useState(1)
  const [passType, setPassType] = useState<PassType>('' as PassType)
  const [threshold, setThreshold] = useState(10)
  const [rewardDesc, setRewardDesc] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [newPass, setNewPass] = useState<Pass | null>(null)

  const [qrPass, setQrPass] = useState<Pass | null>(null)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

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
      const { data } = await supabase.from('passes').select('*').eq('tenant_id', t.id).order('created_at', { ascending: false })
      setPasses(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  const generate = async () => {
    if (!tenant || !passType) return
    setGenerating(true)
    setError('')
    const PASS_LABEL = PASS_TYPES.find(p => p.value === passType)?.label || 'Carte'

    const textModules = passType === 'fidelite'
      ? [{ id: 'reward', header: `Récompense après ${threshold} visites`, body: rewardDesc || 'Récompense offerte' }]
      : rewardDesc ? [{ id: 'desc', header: 'Offre', body: rewardDesc }] : []

    try {
      const res = await fetch('/api/passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardTitle: `${tenant.name} — ${PASS_LABEL}`,
          header: tenant.name,
          hexBackgroundColor: tenant.primary_color,
          barcodeType: 'QR_CODE',
          barcodeValue: `${appUrl}/install/`,
          textModulesData: textModules,
          ...(tenant.logo_url && { logoUrl: tenant.logo_url }),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const supabase = createClient()
      const { data: pass } = await supabase.from('passes').insert({
        type: passType,
        name: PASS_LABEL,
        reward_threshold: threshold,
        reward_description: rewardDesc || null,
        addtowallet_pass_id: data.passId,
        install_url: data.installUrl,
        qr_url: `${appUrl}/install/${data.passId}`,
        tenant_id: tenant.id,
      }).select().single()

      if (pass) {
        setNewPass(pass)
        setPasses(prev => [pass, ...prev])
        setStep(3)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setGenerating(false)
    }
  }

  const resetCreate = () => { setCreating(false); setStep(1); setPassType('' as PassType); setThreshold(10); setRewardDesc(''); setNewPass(null); setError('') }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-400 animate-pulse">Chargement...</div></div>

  return (
    <div>
      <div style={{ background: tenant?.primary_color || '#6366f1' }} className="px-4 pt-10 pb-5">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">💳 Cartes Wallet</h1>
            <p className="text-white/60 text-xs">{passes.length} carte{passes.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="bg-white text-sm font-bold px-4 py-2 rounded-xl active:scale-95 transition-all"
            style={{ color: tenant?.primary_color }}
          >
            + Créer
          </button>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {passes.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">💳</div>
            <p className="text-gray-500 text-sm mb-4">Créez une carte Wallet — les clients l&apos;installent en scannant un QR</p>
            <button onClick={() => setCreating(true)} className="px-6 py-3 rounded-xl font-bold text-white" style={{ background: tenant?.primary_color }}>⚡ Créer ma première carte</button>
          </div>
        ) : passes.map(p => (
          <div key={p.id} onClick={() => setQrPass(p)} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm cursor-pointer active:scale-98 transition-all flex items-center justify-between">
            <div>
              <div className="font-bold text-gray-900">{TYPE_LABELS[p.type]}</div>
              {p.reward_description && <div className="text-xs text-gray-500 mt-0.5">{p.reward_description}</div>}
              <div className="text-xs text-gray-400 mt-1">{new Date(p.created_at).toLocaleDateString('fr-FR')}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-2">
              <QRCodeSVG value={`${appUrl}/install/${p.id}`} size={52} />
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {creating && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 max-w-lg mx-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900">
                {step === 1 && '⚡ Type de carte'}
                {step === 2 && '🎯 Récompense'}
                {step === 3 && '✅ Carte créée !'}
              </h2>
              <button onClick={resetCreate} className="text-gray-400 text-2xl leading-none">×</button>
            </div>

            {step === 1 && (
              <div className="space-y-2">
                {PASS_TYPES.map(t => (
                  <button key={t.value} onClick={() => { setPassType(t.value); setStep(2) }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 bg-white text-left active:scale-98 transition-all hover:border-indigo-200">
                    <span className="text-3xl">{t.emoji}</span>
                    <div>
                      <div className="font-bold text-gray-900">{t.label}</div>
                      <div className="text-xs text-gray-400">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                {passType === 'fidelite' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Visites avant récompense</label>
                    <div className="flex gap-2">
                      {[5, 8, 10, 15, 20].map(n => (
                        <button key={n} onClick={() => setThreshold(n)}
                          className={`flex-1 py-3 rounded-xl font-bold text-lg border-2 transition-all ${threshold === n ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-700'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {passType === 'fidelite' ? 'Récompense offerte' : 'Description'}
                  </label>
                  <input type="text" value={rewardDesc} onChange={e => setRewardDesc(e.target.value)}
                    placeholder={passType === 'fidelite' ? 'Ex: Café offert, -20%...' : 'Description de la carte...'}
                    className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-400" />
                </div>
                {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
                <button onClick={generate} disabled={generating}
                  className="w-full py-4 rounded-2xl font-bold text-white text-lg disabled:opacity-50 active:scale-95 transition-all"
                  style={{ background: tenant?.primary_color }}>
                  {generating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Génération...
                    </span>
                  ) : '🎉 Générer la carte'}
                </button>
              </div>
            )}

            {step === 3 && newPass && (
              <div className="space-y-5 text-center">
                <p className="text-gray-500 text-sm">Faites scanner ce QR par vos clients pour installer la carte sur leur Wallet</p>
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-2xl shadow-md border border-gray-100">
                    <QRCodeSVG value={`${appUrl}/install/${newPass.id}`} size={220} level="H" includeMargin />
                  </div>
                </div>
                <p className="text-xs text-gray-300 break-all">{appUrl}/install/{newPass.id}</p>
                {newPass.install_url && (
                  <a href={newPass.install_url} target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-white active:scale-95 transition-all text-sm"
                    style={{ background: tenant?.primary_color }}>
                    📱 Tester l&apos;installation
                  </a>
                )}
                <button onClick={resetCreate} className="w-full py-3 rounded-2xl font-semibold text-gray-600 bg-gray-50 text-sm">Fermer</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrPass && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setQrPass(null)}>
          <div className="bg-white w-full rounded-t-3xl p-6 max-w-lg mx-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h2 className="text-xl font-bold text-center mb-1">{TYPE_LABELS[qrPass.type]}</h2>
            {qrPass.reward_description && <p className="text-center text-gray-400 text-sm mb-5">{qrPass.reward_description}</p>}
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-white rounded-2xl shadow-md border border-gray-100">
                <QRCodeSVG value={`${appUrl}/install/${qrPass.id}`} size={220} level="H" includeMargin />
              </div>
            </div>
            {qrPass.install_url && (
              <a href={qrPass.install_url} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white active:scale-95 transition-all"
                style={{ background: tenant?.primary_color }}>
                📱 Tester l&apos;installation
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
