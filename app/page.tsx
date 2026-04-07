'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.replace('/merchants')
      } else {
        router.replace('/login')
      }
    }
    check()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-indigo-600">
      <div className="text-white text-center">
        <div className="text-4xl font-bold mb-2">Fidelity Up</div>
        <div className="text-indigo-200 animate-pulse">Chargement...</div>
      </div>
    </div>
  )
}
