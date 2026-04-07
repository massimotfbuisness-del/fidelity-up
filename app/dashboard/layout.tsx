'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', emoji: '📊' },
  { href: '/dashboard/clients', label: 'Clients', emoji: '👥' },
  { href: '/dashboard/passes', label: 'Cartes', emoji: '💳' },
  { href: '/dashboard/settings', label: 'Paramètres', emoji: '⚙️' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {children}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
        {NAV.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors ${active ? 'text-indigo-600' : 'text-gray-500'}`}
            >
              <span className="text-xl mb-0.5">{item.emoji}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
