'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { href: '/board', label: 'Board', emoji: '📋' },
  { href: '/board/passes', label: 'Cartes', emoji: '💳' },
  { href: '/board/settings', label: 'Config', emoji: '⚙️' },
]

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {children}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50 max-w-lg mx-auto">
        {NAV.map((item) => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} className={`flex-1 flex flex-col items-center py-3 text-xs font-semibold transition-colors ${active ? 'text-indigo-600' : 'text-gray-400'}`}>
              <span className="text-xl mb-0.5">{item.emoji}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
