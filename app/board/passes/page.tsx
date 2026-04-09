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

const LU_LABEL: React.CSSProperties = {
  fontFamily: 'Raleway, sans-serif',
  fontWeight: 800,
  fontSize: '10px',
  letterSpacing: '0.25em',
  textTransform: 'uppercase',
  color: '#7A7670',
}

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

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1C1A17' }}>
      <div style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 100, fontSize: '32px', color: '#F4F2EF', letterSpacing: '-0.02em' }}>
        14 <span style={{ color: '#B08050' }}>Level Up</span>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F4F2EF' }}>
      {/* Header */}
      <div style={{ background: '#1C1A17', padding: '40px 20px 24px' }}>
        <div style={{ maxWidth: '512px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <button
              onClick={() => router.push('/board')}
              style={{
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 300,
                fontSize: '11px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#7A7670',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                marginBottom: '8px',
                padding: 0,
                display: 'block',
              }}
            >
              ‹ Tableau de bord
            </button>
            <div style={{
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 800,
              fontSize: '18px',
              color: '#F4F2EF',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>Cartes Wallet</div>
            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontWeight: 300,
              fontSize: '10px',
              color: '#7A7670',
              letterSpacing: '0.2em',
              marginTop: '4px',
            }}>{passes.length} carte{passes.length !== 1 ? 's' : ''}</div>
          </div>
          <button
            onClick={() => setCreating(true)}
            style={{
              background: '#B08050',
              color: '#F4F2EF',
              border: 'none',
              padding: '10px 18px',
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 800,
              fontSize: '11px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            + CRÉER
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '512px', margin: '0 auto', padding: '24px 20px' }}>
        {passes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💳</div>
            <p style={{
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 200,
              fontSize: '18px',
              color: '#1C1A17',
              marginBottom: '6px',
            }}>Aucune carte encore</p>
            <p style={{
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 300,
              fontSize: '13px',
              color: '#7A7670',
              marginBottom: '24px',
            }}>Créez une carte Wallet — les clients l&apos;installent en scannant un QR</p>
            <button
              onClick={() => setCreating(true)}
              style={{
                background: '#B08050',
                color: '#F4F2EF',
                border: 'none',
                padding: '14px 28px',
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 800,
                fontSize: '11px',
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              CRÉER MA PREMIÈRE CARTE →
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {passes.map(p => (
              <button
                key={p.id}
                onClick={() => setQrPass(p)}
                style={{
                  background: '#fff',
                  border: '1px solid #C8B89A',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <div>
                  <div style={{
                    fontFamily: 'Raleway, sans-serif',
                    fontWeight: 700,
                    fontSize: '14px',
                    color: '#1C1A17',
                  }}>{TYPE_LABELS[p.type]}</div>
                  {p.reward_description && (
                    <div style={{
                      fontFamily: 'Raleway, sans-serif',
                      fontWeight: 300,
                      fontSize: '12px',
                      color: '#7A7670',
                      marginTop: '2px',
                    }}>{p.reward_description}</div>
                  )}
                  <div style={{
                    fontFamily: 'DM Mono, monospace',
                    fontWeight: 300,
                    fontSize: '10px',
                    color: '#B0A090',
                    marginTop: '4px',
                  }}>{new Date(p.created_at).toLocaleDateString('fr-FR')}</div>
                </div>
                <div style={{ padding: '8px', background: '#F4F2EF', border: '1px solid #C8B89A' }}>
                  <QRCodeSVG value={`${appUrl}/install/${p.id}`} size={48} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {creating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,26,23,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{
            background: '#F4F2EF',
            width: '100%',
            maxWidth: '512px',
            margin: '0 auto',
            padding: '28px 24px 32px',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div style={{ width: '32px', height: '2px', background: '#C8B89A', margin: '0 auto 20px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <p style={{
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 800,
                fontSize: '13px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#1C1A17',
              }}>
                {step === 1 && 'TYPE DE CARTE'}
                {step === 2 && 'PARAMÈTRES'}
                {step === 3 && 'CARTE CRÉÉE'}
              </p>
              <button
                onClick={resetCreate}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#7A7670', lineHeight: 1 }}
              >×</button>
            </div>

            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {PASS_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => { setPassType(t.value); setStep(2) }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '16px',
                      background: '#fff',
                      border: '1px solid #C8B89A',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <span style={{ fontSize: '28px' }}>{t.emoji}</span>
                    <div>
                      <div style={{
                        fontFamily: 'Raleway, sans-serif',
                        fontWeight: 700,
                        fontSize: '14px',
                        color: '#1C1A17',
                      }}>{t.label}</div>
                      <div style={{
                        fontFamily: 'Raleway, sans-serif',
                        fontWeight: 300,
                        fontSize: '12px',
                        color: '#7A7670',
                      }}>{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {passType === 'fidelite' && (
                  <div>
                    <p style={{ ...LU_LABEL, marginBottom: '10px' }}>Visites avant récompense</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[5, 8, 10, 15, 20].map(n => (
                        <button
                          key={n}
                          onClick={() => setThreshold(n)}
                          style={{
                            flex: 1,
                            padding: '12px 0',
                            background: threshold === n ? '#B08050' : '#fff',
                            border: `1px solid ${threshold === n ? '#B08050' : '#C8B89A'}`,
                            fontFamily: 'Raleway, sans-serif',
                            fontWeight: 800,
                            fontSize: '16px',
                            color: threshold === n ? '#F4F2EF' : '#1C1A17',
                            cursor: 'pointer',
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p style={{ ...LU_LABEL, marginBottom: '8px' }}>
                    {passType === 'fidelite' ? 'Récompense offerte' : 'Description'}
                  </p>
                  <input
                    type="text"
                    value={rewardDesc}
                    onChange={e => setRewardDesc(e.target.value)}
                    placeholder={passType === 'fidelite' ? 'Ex: Café offert, -20%...' : 'Description...'}
                    style={{
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      borderBottom: '1px solid #C8B89A',
                      padding: '10px 0',
                      fontFamily: 'Raleway, sans-serif',
                      fontWeight: 300,
                      fontSize: '15px',
                      color: '#1C1A17',
                      outline: 'none',
                    }}
                  />
                </div>
                {error && (
                  <div style={{
                    background: '#fff0f0',
                    color: '#b00',
                    fontSize: '12px',
                    padding: '10px 14px',
                    fontFamily: 'Raleway, sans-serif',
                    fontWeight: 300,
                  }}>{error}</div>
                )}
                <button
                  onClick={generate}
                  disabled={generating}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: generating ? '#C8B89A' : '#B08050',
                    border: 'none',
                    fontFamily: 'Raleway, sans-serif',
                    fontWeight: 800,
                    fontSize: '11px',
                    letterSpacing: '0.35em',
                    textTransform: 'uppercase',
                    color: '#F4F2EF',
                    cursor: generating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {generating ? 'GÉNÉRATION EN COURS...' : 'GÉNÉRER LA CARTE →'}
                </button>
              </div>
            )}

            {step === 3 && newPass && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <p style={{
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 300,
                  fontSize: '13px',
                  color: '#7A7670',
                  textAlign: 'center',
                }}>Faites scanner ce QR par vos clients pour installer la carte sur leur Wallet</p>
                <div style={{ padding: '16px', background: '#fff', border: '1px solid #C8B89A' }}>
                  <QRCodeSVG value={`${appUrl}/install/${newPass.id}`} size={200} level="H" includeMargin />
                </div>
                <p style={{
                  fontFamily: 'DM Mono, monospace',
                  fontWeight: 300,
                  fontSize: '9px',
                  color: '#B0A090',
                  wordBreak: 'break-all',
                  textAlign: 'center',
                }}>{appUrl}/install/{newPass.id}</p>
                {newPass.install_url && (
                  <a
                    href={newPass.install_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '14px',
                      background: '#1C1A17',
                      color: '#F4F2EF',
                      textDecoration: 'none',
                      fontFamily: 'Raleway, sans-serif',
                      fontWeight: 800,
                      fontSize: '11px',
                      letterSpacing: '0.25em',
                      textTransform: 'uppercase',
                    }}
                  >
                    📱 TESTER L&apos;INSTALLATION →
                  </a>
                )}
                <button
                  onClick={resetCreate}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: 'none',
                    border: '1px solid #C8B89A',
                    fontFamily: 'Raleway, sans-serif',
                    fontWeight: 300,
                    fontSize: '13px',
                    color: '#7A7670',
                    cursor: 'pointer',
                    letterSpacing: '0.1em',
                  }}
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrPass && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(28,26,23,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setQrPass(null)}
        >
          <div
            style={{ background: '#F4F2EF', width: '100%', maxWidth: '512px', margin: '0 auto', padding: '28px 24px 32px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '32px', height: '2px', background: '#C8B89A', margin: '0 auto 20px' }} />
            <p style={{
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 800,
              fontSize: '14px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#1C1A17',
              textAlign: 'center',
              marginBottom: '4px',
            }}>{TYPE_LABELS[qrPass.type]}</p>
            {qrPass.reward_description && (
              <p style={{
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 300,
                fontSize: '13px',
                color: '#7A7670',
                textAlign: 'center',
                marginBottom: '20px',
              }}>{qrPass.reward_description}</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ padding: '16px', background: '#fff', border: '1px solid #C8B89A' }}>
                <QRCodeSVG value={`${appUrl}/install/${qrPass.id}`} size={200} level="H" includeMargin />
              </div>
            </div>
            {qrPass.install_url && (
              <a
                href={qrPass.install_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px',
                  background: '#B08050',
                  color: '#F4F2EF',
                  textDecoration: 'none',
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 800,
                  fontSize: '11px',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                }}
              >
                📱 TESTER L&apos;INSTALLATION →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
