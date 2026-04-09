'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase'
import type { Client, Tenant, Pass } from '@/lib/types'

const QrScannerModal = dynamic(() => import('@/components/QrScannerModal'), { ssr: false })

const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

const LU: Record<string, React.CSSProperties> = {
  label: {
    fontFamily: 'Raleway, sans-serif',
    fontWeight: 800,
    fontSize: '10px',
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    color: '#7A7670',
  },
  value: {
    fontFamily: 'Raleway, sans-serif',
    fontWeight: 100,
    fontSize: '28px',
    color: '#1C1A17',
    letterSpacing: '-0.02em',
    lineHeight: 1,
  },
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div style={{ width: '100%', height: '2px', background: '#C8B89A', marginTop: '6px' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
    </div>
  )
}

function ClientCard({ client, threshold, color, onClick }: { client: Client; threshold: number; color: string; onClick: () => void }) {
  const dormant = !client.last_visit || (Date.now() - new Date(client.last_visit).getTime()) >= 21 * 86400000
  const hasReward = client.visits_count >= threshold
  const lastVisitStr = client.last_visit
    ? new Date(client.last_visit).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : 'Jamais'

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        background: '#fff',
        border: hasReward ? '1px solid #B08050' : dormant ? '1px solid #e8d5d5' : '1px solid #C8B89A',
        padding: '14px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <div style={{
            fontFamily: 'Raleway, sans-serif',
            fontWeight: 700,
            fontSize: '14px',
            color: '#1C1A17',
            lineHeight: 1.2,
          }}>{client.name || client.phone}</div>
          {client.name && (
            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontWeight: 300,
              fontSize: '10px',
              color: '#7A7670',
              marginTop: '2px',
            }}>{client.phone}</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          {hasReward && <span style={{ fontSize: '14px' }}>🎁</span>}
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dormant ? '#e07070' : '#70c070' }} />
        </div>
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'DM Mono, monospace',
        fontWeight: 300,
        fontSize: '10px',
        color: '#7A7670',
        marginBottom: '2px',
      }}>
        <span>{client.visits_count}/{threshold} visites</span>
        <span>{lastVisitStr}</span>
      </div>
      <ProgressBar value={client.visits_count} max={threshold} color={hasReward ? '#B08050' : color} />
    </button>
  )
}

export default function BoardPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [threshold, setThreshold] = useState(10)
  const [loading, setLoading] = useState(true)
  const [loyaltyPass, setLoyaltyPass] = useState<Pass | null>(null)

  const [visitModal, setVisitModal] = useState(false)
  const [visitPhone, setVisitPhone] = useState('')
  const [visitName, setVisitName] = useState('')
  const [visitMsg, setVisitMsg] = useState('')
  const [visitLoading, setVisitLoading] = useState(false)

  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const activeTenantId = localStorage.getItem('activeTenantId')
    let query = supabase.from('tenants').select('*').eq('owner_id', user.id)
    if (activeTenantId) query = query.eq('id', activeTenantId)
    const { data: t } = await query.single()
    if (!t) { router.push('/merchants'); return }
    setTenant(t)

    const { data: pass } = await supabase.from('passes').select('*').eq('tenant_id', t.id).eq('type', 'fidelite').order('created_at').limit(1).single()
    if (pass) {
      setThreshold(pass.reward_threshold)
      setLoyaltyPass(pass)
    }

    const { data: cls } = await supabase.from('clients').select('*').eq('tenant_id', t.id).order('last_visit', { ascending: false, nullsFirst: false })
    setClients(cls || [])
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  const recordVisit = async (clientOverride?: Client) => {
    if (!tenant) return
    const supabase = createClient()
    const phone = clientOverride ? clientOverride.phone : visitPhone.trim()
    if (!phone) return
    setVisitLoading(true)

    let { data: client } = await supabase.from('clients').select('*').eq('phone', phone).eq('tenant_id', tenant.id).single()
    if (!client) {
      const { data: nc } = await supabase.from('clients').insert({ phone, name: visitName.trim() || null, tenant_id: tenant.id, visits_count: 0 }).select().single()
      client = nc
    }
    if (!client) { setVisitLoading(false); return }

    const newCount = (client.visits_count || 0) + 1
    await supabase.from('visits').insert({ client_id: client.id, tenant_id: tenant.id })
    await supabase.from('clients').update({ visits_count: newCount, last_visit: new Date().toISOString() }).eq('id', client.id)

    const msg = newCount >= threshold ? `🎁 ${client.name || phone} a débloqué sa récompense ! (${newCount} visites)` : `✅ Visite #${newCount} — ${client.name || phone}`
    setVisitMsg(msg)
    setVisitPhone('')
    setVisitName('')
    setVisitModal(false)
    setSelectedClient(null)
    setTimeout(() => setVisitMsg(''), 4000)
    setVisitLoading(false)
    await load()
  }

  const handleScanResult = async (scannedPhone: string) => {
    setScannerOpen(false)
    if (!scannedPhone.trim()) return
    if (!tenant) return
    setVisitLoading(true)
    const supabase = createClient()
    const phone = scannedPhone.trim()
    let { data: client } = await supabase.from('clients').select('*').eq('phone', phone).eq('tenant_id', tenant.id).single()
    if (!client) {
      const { data: nc } = await supabase.from('clients').insert({ phone, tenant_id: tenant.id, visits_count: 0 }).select().single()
      client = nc
    }
    if (!client) { setVisitLoading(false); return }
    const newCount = (client.visits_count || 0) + 1
    await supabase.from('visits').insert({ client_id: client.id, tenant_id: tenant.id })
    await supabase.from('clients').update({ visits_count: newCount, last_visit: new Date().toISOString() }).eq('id', client.id)
    const msg = newCount >= threshold ? `🎁 ${client.name || phone} a débloqué sa récompense ! (${newCount} visites)` : `✅ Visite #${newCount} — ${client.name || phone}`
    setVisitMsg(msg)
    setTimeout(() => setVisitMsg(''), 4000)
    setVisitLoading(false)
    await load()
  }

  const now = Date.now()
  const active = clients.filter(c => c.last_visit && (now - new Date(c.last_visit).getTime()) < 21 * 86400000)
  const dormant = clients.filter(c => !c.last_visit || (now - new Date(c.last_visit).getTime()) >= 21 * 86400000)
  const rewards = clients.filter(c => c.visits_count >= threshold)

  const brandColor = tenant?.primary_color || '#B08050'

  const installUrl = loyaltyPass ? `${appUrl}/install/${loyaltyPass.id}` : ''

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1C1A17' }}>
      <div style={{
        fontFamily: 'Raleway, sans-serif',
        fontWeight: 100,
        fontSize: '32px',
        color: '#F4F2EF',
        letterSpacing: '-0.02em',
      }}>14 <span style={{ color: '#B08050' }}>Level Up</span></div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F4F2EF' }}>
      {/* Header */}
      <div style={{ background: '#1C1A17', padding: '40px 20px 24px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '512px', margin: '0 auto' }}>
          <button
            onClick={() => router.push('/merchants')}
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
              marginBottom: '12px',
              padding: 0,
            }}
          >
            ‹ Commerces
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 800,
                fontSize: '18px',
                color: '#F4F2EF',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>{tenant?.name}</div>
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontWeight: 300,
                fontSize: '10px',
                color: '#7A7670',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginTop: '4px',
              }}>{tenant?.type}</div>
            </div>
            <Link
              href="/board/passes"
              style={{
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 800,
                fontSize: '10px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#B08050',
                border: '1px solid #B08050',
                padding: '6px 12px',
                textDecoration: 'none',
              }}
            >
              CARTES
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '512px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Toast */}
        {visitMsg && (
          <div style={{
            background: '#1C1A17',
            color: '#F4F2EF',
            padding: '12px 16px',
            fontFamily: 'Raleway, sans-serif',
            fontWeight: 300,
            fontSize: '13px',
            marginBottom: '16px',
            borderLeft: '3px solid #B08050',
          }}>
            {visitMsg}
          </div>
        )}

        {/* QR Card */}
        <div style={{
          background: '#fff',
          border: '1px solid #C8B89A',
          padding: '24px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          {loyaltyPass ? (
            <>
              <p style={{ ...LU.label, marginBottom: '20px' }}>Faites scanner ce QR par vos clients</p>
              <div style={{ padding: '12px', background: '#F4F2EF', border: '1px solid #C8B89A' }}>
                <QRCodeSVG value={installUrl} size={180} />
              </div>
              <p style={{
                fontFamily: 'DM Mono, monospace',
                fontWeight: 300,
                fontSize: '9px',
                color: '#7A7670',
                letterSpacing: '0.05em',
                marginTop: '12px',
                textAlign: 'center',
                wordBreak: 'break-all',
              }}>{installUrl}</p>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎴</div>
              <p style={{
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 300,
                fontSize: '13px',
                color: '#7A7670',
                textAlign: 'center',
                marginBottom: '16px',
              }}>Aucune carte de fidélité créée.<br />Créez-en une pour générer votre QR code.</p>
              <Link
                href="/board/passes"
                style={{
                  background: '#B08050',
                  color: '#F4F2EF',
                  padding: '12px 24px',
                  textDecoration: 'none',
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 800,
                  fontSize: '11px',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                }}
              >
                CRÉER UNE CARTE →
              </Link>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <button
            onClick={() => setScannerOpen(true)}
            style={{
              flex: 1,
              padding: '16px',
              background: '#fff',
              border: '1px solid #C8B89A',
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 800,
              fontSize: '11px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#1C1A17',
              cursor: 'pointer',
            }}
          >
            📷 Scanner
          </button>
          <button
            onClick={() => setVisitModal(true)}
            style={{
              flex: 1,
              padding: '16px',
              background: '#B08050',
              border: 'none',
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 800,
              fontSize: '11px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#F4F2EF',
              cursor: 'pointer',
            }}
          >
            + VISITE
          </button>
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex',
          gap: '1px',
          background: '#C8B89A',
          marginBottom: '24px',
        }}>
          {[
            { value: clients.length, label: 'Clients' },
            { value: active.length, label: 'Actifs' },
            { value: rewards.length, label: 'Récomp.' },
          ].map(({ value, label }) => (
            <div key={label} style={{
              flex: 1,
              background: '#F4F2EF',
              padding: '14px 12px',
              textAlign: 'center',
            }}>
              <div style={{ ...LU.value, fontSize: '22px' }}>{value}</div>
              <div style={{ ...LU.label, marginTop: '4px' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {clients.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
            <p style={{
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 200,
              fontSize: '18px',
              color: '#1C1A17',
              marginBottom: '6px',
            }}>Aucun client encore</p>
            <p style={{
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 300,
              fontSize: '13px',
              color: '#7A7670',
            }}>Enregistrez une visite ou créez une carte Wallet</p>
          </div>
        )}

        {/* Rewards section */}
        {rewards.length > 0 && (
          <section style={{ marginBottom: '24px' }}>
            <p style={{ ...LU.label, marginBottom: '12px', color: '#B08050' }}>
              🎁 RÉCOMPENSES ({rewards.length})
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {rewards.map(c => (
                <ClientCard key={c.id} client={c} threshold={threshold} color={brandColor} onClick={() => setSelectedClient(c)} />
              ))}
            </div>
          </section>
        )}

        {/* Active section */}
        {active.filter(c => c.visits_count < threshold).length > 0 && (
          <section style={{ marginBottom: '24px' }}>
            <p style={{ ...LU.label, marginBottom: '12px' }}>
              ACTIFS ({active.filter(c => c.visits_count < threshold).length})
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {active.filter(c => c.visits_count < threshold).map(c => (
                <ClientCard key={c.id} client={c} threshold={threshold} color={brandColor} onClick={() => setSelectedClient(c)} />
              ))}
            </div>
          </section>
        )}

        {/* Dormant section */}
        {dormant.length > 0 && (
          <section style={{ marginBottom: '24px' }}>
            <p style={{ ...LU.label, marginBottom: '12px', color: '#b07070' }}>
              DORMANTS +21J ({dormant.length})
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {dormant.map(c => (
                <ClientCard key={c.id} client={c} threshold={threshold} color={brandColor} onClick={() => setSelectedClient(c)} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Visit Modal */}
      {visitModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(28,26,23,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setVisitModal(false)}
        >
          <div
            style={{ background: '#F4F2EF', width: '100%', maxWidth: '512px', margin: '0 auto', padding: '28px 24px 32px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '32px', height: '2px', background: '#C8B89A', margin: '0 auto 20px' }} />
            <p style={{
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 800,
              fontSize: '13px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#1C1A17',
              marginBottom: '20px',
            }}>+ Enregistrer une visite</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="tel"
                autoFocus
                value={visitPhone}
                onChange={e => setVisitPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && recordVisit()}
                placeholder="Téléphone client *"
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid #C8B89A',
                  padding: '10px 0',
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 300,
                  fontSize: '16px',
                  color: '#1C1A17',
                  outline: 'none',
                }}
              />
              <input
                type="text"
                value={visitName}
                onChange={e => setVisitName(e.target.value)}
                placeholder="Prénom (optionnel)"
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid #C8B89A',
                  padding: '10px 0',
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 300,
                  fontSize: '16px',
                  color: '#1C1A17',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => recordVisit()}
                disabled={visitLoading || !visitPhone.trim()}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: visitLoading || !visitPhone.trim() ? '#C8B89A' : '#B08050',
                  border: 'none',
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 800,
                  fontSize: '11px',
                  letterSpacing: '0.35em',
                  textTransform: 'uppercase',
                  color: '#F4F2EF',
                  cursor: visitLoading || !visitPhone.trim() ? 'not-allowed' : 'pointer',
                  marginTop: '8px',
                }}
              >
                {visitLoading ? 'ENREGISTREMENT...' : 'CONFIRMER LA VISITE →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {scannerOpen && (
        <QrScannerModal
          onResult={handleScanResult}
          onClose={() => setScannerOpen(false)}
          color={brandColor}
        />
      )}

      {/* Client Detail Modal */}
      {selectedClient && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(28,26,23,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setSelectedClient(null)}
        >
          <div
            style={{ background: '#F4F2EF', width: '100%', maxWidth: '512px', margin: '0 auto', padding: '28px 24px 32px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '32px', height: '2px', background: '#C8B89A', margin: '0 auto 20px' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: '#1C1A17',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 800,
                fontSize: '20px',
                color: '#F4F2EF',
                flexShrink: 0,
              }}>
                {(selectedClient.name || selectedClient.phone).charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 700,
                  fontSize: '18px',
                  color: '#1C1A17',
                }}>{selectedClient.name || selectedClient.phone}</div>
                {selectedClient.name && (
                  <div style={{
                    fontFamily: 'DM Mono, monospace',
                    fontWeight: 300,
                    fontSize: '11px',
                    color: '#7A7670',
                  }}>{selectedClient.phone}</div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1px', background: '#C8B89A', marginBottom: '20px' }}>
              {[
                { value: selectedClient.visits_count, label: 'Visites' },
                { value: Math.floor(selectedClient.visits_count / threshold), label: 'Récomp.' },
                {
                  value: selectedClient.last_visit
                    ? new Date(selectedClient.last_visit).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                    : 'Jamais',
                  label: 'Dernière',
                },
              ].map(({ value, label }) => (
                <div key={label} style={{ flex: 1, background: '#fff', padding: '12px', textAlign: 'center' }}>
                  <div style={{
                    fontFamily: 'Raleway, sans-serif',
                    fontWeight: 100,
                    fontSize: '20px',
                    color: '#1C1A17',
                    letterSpacing: '-0.02em',
                  }}>{value}</div>
                  <div style={{ ...LU.label, marginTop: '4px' }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ ...LU.label }}>Progression</span>
                <span style={{ ...LU.label, color: '#B08050' }}>{selectedClient.visits_count % threshold} / {threshold}</span>
              </div>
              <ProgressBar value={selectedClient.visits_count % threshold} max={threshold} color={brandColor} />
            </div>

            {visitMsg && (
              <div style={{
                background: '#1C1A17',
                color: '#F4F2EF',
                padding: '10px 14px',
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 300,
                fontSize: '12px',
                marginTop: '12px',
                borderLeft: '3px solid #B08050',
              }}>{visitMsg}</div>
            )}

            <button
              onClick={() => recordVisit(selectedClient)}
              disabled={visitLoading}
              style={{
                width: '100%',
                padding: '16px',
                background: visitLoading ? '#C8B89A' : '#B08050',
                border: 'none',
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 800,
                fontSize: '11px',
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
                color: '#F4F2EF',
                cursor: visitLoading ? 'not-allowed' : 'pointer',
                marginTop: '20px',
              }}
            >
              {visitLoading ? 'ENREGISTREMENT...' : '+ ENREGISTRER UNE VISITE →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
