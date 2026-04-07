'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase'
import type { Pass, Tenant } from '@/lib/types'

const TYPE_LABELS: Record<string, string> = {
  fidelite: '⭐ Fidélité',
  visite: '👤 Visite',
  cadeau: '🎁 Cadeau',
  coupon: '🏷️ Coupon',
}

export default function PassesPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [passes, setPasses] = useState<Pass[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPass, setSelectedPass] = useState<Pass | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: t } = await supabase.from('tenants').select('*').eq('owner_id', user.id).single()
      if (!t) { router.push('/onboarding'); return }
      setTenant(t)
      const { data } = await supabase.from('passes').select('*').eq('tenant_id', t.id).order('created_at', { ascending: false })
      setPasses(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-400 animate-pulse">Chargement...</div></div>

  return (
    <div>
      <div style={{ background: tenant?.primary_color || '#6366f1' }} className="px-4 pt-12 pb-6">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">💳 Cartes Wallet</h1>
            <p className="text-white/70 text-sm">{passes.length} carte{passes.length !== 1 ? 's' : ''} créée{passes.length !== 1 ? 's' : ''}</p>
          </div>
          <Link
            href="/quick-create"
            className="bg-white text-indigo-700 px-4 py-2 rounded-xl font-semibold text-sm active:scale-95 transition-all"
          >
            + Créer
          </Link>
        </div>
      </div>

      <div className="px-4 py-4 max-w-md mx-auto">
        {passes.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">💳</div>
            <h3 className="font-semibold text-gray-900 mb-2">Aucune carte créée</h3>
            <p className="text-gray-500 text-sm mb-6">Créez votre première carte Wallet en moins de 2 minutes</p>
            <Link
              href="/quick-create"
              className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold active:scale-95 transition-all"
            >
              ⚡ Création rapide
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {passes.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedPass(p)}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm cursor-pointer active:scale-98 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-semibold text-gray-900">{TYPE_LABELS[p.type] || p.type}</div>
                    <div className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('fr-FR')}</div>
                  </div>
                  <div className="bg-indigo-50 rounded-xl p-2">
                    <QRCodeSVG value={`${appUrl}/install/${p.id}`} size={48} />
                  </div>
                </div>
                {p.reward_description && (
                  <div className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2">
                    {p.type === 'fidelite' ? `🎁 ${p.reward_description} à ${p.reward_threshold} visites` : p.reward_description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPass && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setSelectedPass(null)}>
          <div className="bg-white w-full rounded-t-3xl p-6 max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
            <h2 className="text-xl font-bold text-gray-900 mb-1">{TYPE_LABELS[selectedPass.type]}</h2>
            {selectedPass.reward_description && (
              <p className="text-gray-500 text-sm mb-6">{selectedPass.reward_description}</p>
            )}
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-white rounded-2xl shadow-md border border-gray-100">
                <QRCodeSVG
                  value={`${appUrl}/install/${selectedPass.id}`}
                  size={200}
                  level="H"
                  includeMargin
                />
              </div>
            </div>
            <p className="text-center text-xs text-gray-400 mb-6 break-all">{appUrl}/install/{selectedPass.id}</p>
            {selectedPass.install_url && (
              <a
                href={selectedPass.install_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 rounded-xl font-semibold active:scale-95 transition-all"
              >
                📱 Tester l&apos;installation
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
