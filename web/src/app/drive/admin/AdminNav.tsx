'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  external?: boolean
}

export default function AdminNav() {
  const pathname = usePathname()

  const navItems: NavItem[] = [
    { href: '/drive/admin', label: 'Overview' },
    { href: '/drive/admin/tracks', label: 'Track Maps' },
    { href: '/drive/admin/brands', label: 'Car Brands' },
    { href: '/drive/admin/users', label: 'Users' },
    { href: '/drive/admin/logs', label: 'Logs' },
  ]

  const toolItems: NavItem[] = [
    { href: '/drive/admin/styles', label: 'Tokens' },
    { href: '/drive/admin/components', label: 'Components' },
    { href: 'http://localhost:6006', label: 'Storybook', external: true },
  ]

  const isActive = (href: string) => {
    if (href === '/drive/admin') {
      return pathname === '/drive/admin'
    }
    return pathname.startsWith(href)
  }

  const linkClass = (item: NavItem) =>
    `px-4 py-2 text-sm font-medium tracking-wide uppercase transition-colors border-b-2 -mb-[1px] ${
      !item.external && isActive(item.href)
        ? 'text-[var(--k10-red)] border-[var(--k10-red)]'
        : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-dim)]'
    }`

  return (
    <div className="flex items-center w-full">
      <div className="flex">
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={linkClass(item)}>
            {item.label}
          </Link>
        ))}
      </div>
      <div className="ml-auto flex">
        {toolItems.map(item =>
          item.external ? (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass(item)}
            >
              {item.label} ↗
            </a>
          ) : (
            <Link key={item.href} href={item.href} className={linkClass(item)}>
              {item.label}
            </Link>
          )
        )}
      </div>
    </div>
  )
}
