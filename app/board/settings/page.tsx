'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Tenant } from '@/lib/types'

const LU_LABEL: React.CSSProperties = {
  fontFamily: 'Raleway, sans-serif',
  fontWeight: 800,
  fontSize: '10px',
  letterSpacing: '0.25em',
  textTransform: 'uppercase',
  color: '#7A7670',
  display: 'block',
  marginBottom: '6px',
}

export default function BoardSettingsPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', address: '', primary_color: '#B08050' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

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
      setForm({ name: t.name, phone: t.phone || '', address: t.address || '', primary_color: t.primary_color })
    }
    load()
  }, [router])

  const save = async () => {
    if (!tenant) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('tenants').update({ name: form.name, phone: form.phone || null, address: form.address || null, primary_color: form.primary_color }).eq('id', tenant.id)
    setMsg('Sauvegardé')
    setTimeout(() => setMsg(''), 2000)
    setSaving(false)
  }

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!tenant) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F4F2EF' }}>
      {/* Header */}
      <div style={{ background: '#1C1A17', padding: '40px 20px 24px' }}>
        <div style={{ maxWidth: '512px', margin: '0 auto' }}>
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
              marginBottom: '12px',
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
          }}>Configuration</div>
          <div style={{
            fontFamily: 'DM Mono, monospace',
            fontWeight: 300,
            fontSize: '10px',
            color: '#7A7670',
            letterSpacing: '0.2em',
            marginTop: '4px',
          }}>{tenant.name}</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '512px', margin: '0 auto', padding: '24px 20px' }}>
        {msg && (
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
            ✓ {msg}
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid #C8B89A', padding: '24px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {[
              { key: 'name', label: 'Nom du commerce', type: 'text', placeholder: 'Ex: ISCUT BARBER' },
              { key: 'phone', label: 'Téléphone', type: 'tel', placeholder: '+41 00 000 00 00' },
              { key: 'address', label: 'Adresse', type: 'text', placeholder: 'Rue, Ville' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label style={LU_LABEL}>{label}</label>
                <input
                  type={type}
                  value={(form as Record<string, string>)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid #C8B89A',
                    padding: '8px 0',
                    fontFamily: 'Raleway, sans-serif',
                    fontWeight: 300,
                    fontSize: '15px',
                    color: '#1C1A17',
                    outline: 'none',
                  }}
                />
              </div>
            ))}

            <div>
              <label style={LU_LABEL}>Couleur de la carte</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                  style={{ width: '44px', height: '44px', border: '1px solid #C8B89A', cursor: 'pointer', padding: '2px', background: 'none' }}
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['#B08050', '#1C1A17', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, primary_color: c }))}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: c,
                        border: form.primary_color === c ? '2px solid #1C1A17' : '2px solid transparent',
                        cursor: 'pointer',
                        transform: form.primary_color === c ? 'scale(1.15)' : 'none',
                        transition: 'transform 0.15s',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving}
              style={{
                width: '100%',
                padding: '16px',
                background: saving ? '#C8B89A' : '#B08050',
                border: 'none',
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 800,
                fontSize: '11px',
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
                color: '#F4F2EF',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'SAUVEGARDE...' : 'SAUVEGARDER →'}
            </button>
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            width: '100%',
            padding: '16px',
            background: 'none',
            border: '1px solid #C8B89A',
            fontFamily: 'Raleway, sans-serif',
            fontWeight: 300,
            fontSize: '13px',
            letterSpacing: '0.1em',
            color: '#7A7670',
            cursor: 'pointer',
          }}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
