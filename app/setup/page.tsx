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

const PRESET_COLORS = ['#B08050', '#1C1A17', '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
const THRESHOLDS = [5, 8, 10, 15, 20]

const LU_LABEL: React.CSSProperties = {
  fontFamily: 'Raleway, sans-serif',
  fontWeight: 800,
  fontSize: '10px',
  letterSpacing: '0.25em',
  textTransform: 'uppercase' as const,
  color: '#7A7670',
  display: 'block',
  marginBottom: '8px',
}

const LU_INPUT: React.CSSProperties = {
  width: '100%',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid #C8B89A',
  padding: '8px 0',
  fontFamily: 'Raleway, sans-serif',
  fontWeight: 300,
  fontSize: '16px',
  color: '#1C1A17',
  outline: 'none',
}

export default function SetupPage() {
  const router = useRouter()

  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [type, setType] = useState<TenantType>('' as TenantType)
  const [color, setColor] = useState('#B08050')
  const [threshold, setThreshold] = useState(10)
  const [rewardDesc, setRewardDesc] = useState('')
  const [dailyCustomers, setDailyCustomers] = useState('')
  const [staffSize, setStaffSize] = useState('')
  const [hasUbereats, setHasUbereats] = useState(false)
  const [hasWhatsapp, setHasWhatsapp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const goToStep2 = () => {
    if (!name.trim() || !type) return
    setError('')
    setStep(2)
  }

  const submit = async () => {
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const slug = slugify(name) + '-' + Math.random().toString(36).slice(2, 6)
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert({ name: name.trim(), type, primary_color: color, email: user.email, slug, owner_id: user.id })
        .select('id').single()

      if (tenantErr) throw new Error(tenantErr.message)
      const tenantId = tenant.id

      await supabase.from('tenant_profiles').insert({
        tenant_id: tenantId,
        daily_customers: dailyCustomers ? parseInt(dailyCustomers) : null,
        staff_size: staffSize ? parseInt(staffSize) : null,
        has_ubereats: hasUbereats,
        has_whatsapp: hasWhatsapp,
      })

      await supabase.from('tenant_modules').insert({ tenant_id: tenantId, module: 'loyalty', enabled: true })

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

      if (!passRes.ok) throw new Error(`Erreur génération carte: ${await passRes.text()}`)
      const passData = await passRes.json()

      await supabase.from('passes').insert({
        type: 'fidelite',
        name: 'Carte Fidélité',
        reward_threshold: threshold,
        reward_description: rewardDesc || null,
        addtowallet_pass_id: passData.passId,
        group_id: passData.groupId || null,
        install_url: passData.installUrl,
        qr_url: `${origin}/install/${passData.passId}`,
        tenant_id: tenantId,
      })

      localStorage.setItem('activeTenantId', tenantId)
      router.push('/board')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#1C1A17' }}>
      {/* Watermark */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none overflow-hidden" aria-hidden>
        <span style={{
          fontFamily: 'Raleway, sans-serif',
          fontWeight: 100,
          fontSize: 'clamp(180px, 45vw, 360px)',
          color: 'rgba(255,255,255,0.03)',
          lineHeight: 1,
          letterSpacing: '-0.03em',
        }}>14</span>
      </div>

      <div className="relative flex flex-col min-h-screen px-5 py-10">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <span style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 100, fontSize: '32px', color: '#F4F2EF', letterSpacing: '-0.03em', lineHeight: 1 }}>14</span>
          <div style={{ width: '1px', height: '24px', background: '#B08050', opacity: 0.6 }} />
          <div>
            <div style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 800, fontSize: '10px', color: '#F4F2EF', letterSpacing: '0.3em', textTransform: 'uppercase' }}>LEVEL</div>
            <div style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 200, fontSize: '10px', color: '#B08050', letterSpacing: '0.4em', textTransform: 'uppercase' }}>UP</div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-6">
          <div style={{ width: '24px', height: '24px', background: step >= 1 ? '#B08050' : '#7A7670', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 800, fontSize: '10px', color: '#F4F2EF' }}>1</span>
          </div>
          <div style={{ flex: 1, height: '1px', background: step >= 2 ? '#B08050' : '#7A7670', opacity: 0.5 }} />
          <div style={{ width: '24px', height: '24px', background: step >= 2 ? '#B08050' : 'transparent', border: step < 2 ? '1px solid #7A7670' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 800, fontSize: '10px', color: step >= 2 ? '#F4F2EF' : '#7A7670' }}>2</span>
          </div>
        </div>

        {/* Headline */}
        <div className="mb-6">
          <p style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 800, fontSize: '10px', color: '#B08050', letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: '6px' }}>
            {step === 1 ? 'NOUVEAU COMMERCE' : 'PROGRAMME FIDÉLITÉ'}
          </p>
          <h1 style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 200, fontSize: '28px', color: '#F4F2EF', lineHeight: 1.2 }}>
            {step === 1 ? 'Configurez votre commerce' : 'Paramétrez les récompenses'}
          </h1>
        </div>

        {/* Card */}
        <div style={{ background: '#F4F2EF', padding: '28px 24px' }} className="flex-1">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label style={LU_LABEL}>Nom du commerce <span style={{ color: '#B08050' }}>*</span></label>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Barber Club, Chez Mario..."
                  style={LU_INPUT}
                />
              </div>

              <div>
                <label style={LU_LABEL}>Type de commerce</label>
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '10px 4px',
                        border: type === t.value ? '2px solid #B08050' : '1px solid #C8B89A',
                        background: type === t.value ? '#B0805012' : '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{t.emoji}</span>
                      <span style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 700, fontSize: '9px', color: '#1C1A17', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2 }}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={LU_LABEL}>Couleur de vos cartes</label>
                <div className="flex items-center gap-3 mt-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    style={{ width: '48px', height: '48px', border: '1px solid #C8B89A', cursor: 'pointer', padding: '2px' }}
                  />
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        style={{
                          width: '28px',
                          height: '28px',
                          background: c,
                          border: color === c ? '2px solid #1C1A17' : '2px solid transparent',
                          cursor: 'pointer',
                          transform: color === c ? 'scale(1.15)' : 'scale(1)',
                          transition: 'all 0.15s',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {error && <div style={{ background: '#fff0f0', color: '#b00', fontSize: '12px', padding: '10px 14px', fontFamily: 'Raleway, sans-serif' }}>{error}</div>}

              <button
                onClick={goToStep2}
                disabled={!name.trim() || !type}
                style={{
                  width: '100%',
                  background: !name.trim() || !type ? '#C8B89A' : '#B08050',
                  color: '#F4F2EF',
                  border: 'none',
                  padding: '18px',
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 800,
                  fontSize: '11px',
                  letterSpacing: '0.35em',
                  textTransform: 'uppercase',
                  cursor: !name.trim() || !type ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                SUIVANT →
              </button>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div className="space-y-6">
              <button
                onClick={() => { setError(''); setStep(1) }}
                style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 300, fontSize: '12px', color: '#7A7670', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}
              >
                ← Retour
              </button>

              {/* Seuil */}
              <div>
                <label style={LU_LABEL}>Visites avant récompense</label>
                <div className="flex gap-2 mt-2">
                  {THRESHOLDS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setThreshold(n)}
                      style={{
                        flex: 1,
                        padding: '12px 4px',
                        border: threshold === n ? '2px solid #B08050' : '1px solid #C8B89A',
                        background: threshold === n ? '#B0805012' : '#fff',
                        fontFamily: 'Raleway, sans-serif',
                        fontWeight: threshold === n ? 800 : 300,
                        fontSize: '15px',
                        color: threshold === n ? '#B08050' : '#1C1A17',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >{n}</button>
                  ))}
                </div>
              </div>

              {/* Récompense */}
              <div>
                <label style={LU_LABEL}>Récompense offerte</label>
                <input
                  type="text"
                  value={rewardDesc}
                  onChange={(e) => setRewardDesc(e.target.value)}
                  placeholder="Ex: Café offert, -20%, Coupe gratuite..."
                  style={LU_INPUT}
                />
              </div>

              {/* CRM */}
              <div style={{ border: '1px solid #C8B89A', padding: '16px' }}>
                <p style={{ ...LU_LABEL, marginBottom: '16px' }}>Votre activité <span style={{ color: '#C8B89A', fontWeight: 300, letterSpacing: '0.1em', textTransform: 'none', fontSize: '11px' }}>(optionnel)</span></p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label style={{ ...LU_LABEL, fontSize: '9px' }}>Clients / jour</label>
                    <input type="number" min="0" value={dailyCustomers} onChange={(e) => setDailyCustomers(e.target.value)} placeholder="40" style={{ ...LU_INPUT, fontSize: '14px' }} />
                  </div>
                  <div>
                    <label style={{ ...LU_LABEL, fontSize: '9px' }}>Employés</label>
                    <input type="number" min="0" value={staffSize} onChange={(e) => setStaffSize(e.target.value)} placeholder="3" style={{ ...LU_INPUT, fontSize: '14px' }} />
                  </div>
                </div>
                <div className="flex gap-5 mt-4">
                  {[{ label: 'UberEats', val: hasUbereats, set: setHasUbereats }, { label: 'WhatsApp', val: hasWhatsapp, set: setHasWhatsapp }].map(({ label, val, set }) => (
                    <button key={label} onClick={() => set(!val)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <div style={{ width: '36px', height: '20px', background: val ? '#B08050' : '#C8B89A', position: 'relative', transition: 'background 0.2s' }}>
                        <span style={{ position: 'absolute', top: '3px', left: val ? '19px' : '3px', width: '14px', height: '14px', background: '#F4F2EF', transition: 'left 0.2s' }} />
                      </div>
                      <span style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 300, fontSize: '13px', color: '#1C1A17' }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && <div style={{ background: '#fff0f0', color: '#b00', fontSize: '12px', padding: '10px 14px', fontFamily: 'Raleway, sans-serif' }}>{error}</div>}

              <button
                onClick={submit}
                disabled={loading}
                style={{
                  width: '100%',
                  background: loading ? '#C8B89A' : '#1C1A17',
                  color: '#F4F2EF',
                  border: 'none',
                  padding: '18px',
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 800,
                  fontSize: '11px',
                  letterSpacing: '0.35em',
                  textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {loading ? (
                  <>
                    <svg style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    GÉNÉRATION EN COURS...
                  </>
                ) : 'CRÉER ET GÉNÉRER MA CARTE →'}
              </button>
            </div>
          )}
        </div>

        <p style={{ fontFamily: 'DM Mono, monospace', fontWeight: 300, fontSize: '10px', color: '#7A7670', letterSpacing: '0.2em', textTransform: 'uppercase', textAlign: 'center', marginTop: '20px' }}>
          ÉLÉVATION · MÉTHODE · EXCELLENCE
        </p>
      </div>
    </div>
  )
}
