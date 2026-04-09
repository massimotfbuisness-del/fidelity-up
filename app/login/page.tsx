'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()

    const { error: err } = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    router.push('/merchants')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#1C1A17' }}>
      {/* Background "14" watermark */}
      <div
        className="fixed inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
        aria-hidden
      >
        <span style={{
          fontFamily: 'Raleway, sans-serif',
          fontWeight: 100,
          fontSize: 'clamp(200px, 50vw, 400px)',
          color: 'rgba(255,255,255,0.03)',
          lineHeight: 1,
          letterSpacing: '-0.03em',
        }}>14</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-12 relative">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span style={{
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 100,
              fontSize: '52px',
              color: '#F4F2EF',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}>14</span>
            <div style={{ width: '1px', height: '40px', background: '#B08050', opacity: 0.7 }} />
            <div>
              <div style={{
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 800,
                fontSize: '13px',
                color: '#F4F2EF',
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
                lineHeight: 1.2,
              }}>LEVEL</div>
              <div style={{
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 200,
                fontSize: '13px',
                color: '#B08050',
                letterSpacing: '0.45em',
                textTransform: 'uppercase',
              }}>UP</div>
            </div>
          </div>
          <p style={{
            fontFamily: 'Raleway, sans-serif',
            fontWeight: 200,
            fontSize: '11px',
            color: '#7A7670',
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
          }}>FIDELITY UP</p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm">
          <div style={{ background: '#F4F2EF', borderRadius: '4px' }} className="p-7 shadow-2xl">

            {/* Tab switcher */}
            <div className="flex mb-7" style={{ borderBottom: '1px solid #C8B89A' }}>
              {(['login', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    fontFamily: 'Raleway, sans-serif',
                    fontWeight: 800,
                    fontSize: '11px',
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase',
                    color: mode === m ? '#1C1A17' : '#7A7670',
                    borderBottom: mode === m ? '2px solid #B08050' : '2px solid transparent',
                    marginBottom: '-1px',
                    paddingBottom: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  className="flex-1 pb-2.5 transition-colors"
                >
                  {m === 'login' ? 'Connexion' : 'Créer un compte'}
                </button>
              ))}
            </div>

            <form onSubmit={handle} className="space-y-5">
              {/* Email */}
              <div>
                <label style={{
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 800,
                  fontSize: '10px',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  color: '#7A7670',
                  display: 'block',
                  marginBottom: '6px',
                }}>Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
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

              {/* Password */}
              <div>
                <label style={{
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 800,
                  fontSize: '10px',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  color: '#7A7670',
                  display: 'block',
                  marginBottom: '6px',
                }}>Mot de passe</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  background: loading ? '#C8B89A' : '#B08050',
                  color: '#F4F2EF',
                  border: 'none',
                  padding: '16px',
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 800,
                  fontSize: '11px',
                  letterSpacing: '0.35em',
                  textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {loading ? 'CHARGEMENT...' : mode === 'login' ? 'SE CONNECTER →' : 'CRÉER MON COMPTE →'}
              </button>
            </form>
          </div>

          <p style={{
            fontFamily: 'DM Mono, monospace',
            fontWeight: 300,
            fontSize: '10px',
            color: '#7A7670',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginTop: '24px',
          }}>ÉLÉVATION · MÉTHODE · EXCELLENCE</p>
        </div>
      </div>
    </div>
  )
}
