"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV = [
  { href: "/", label: "Início" },
  { href: "/servicos", label: "Serviços" },
] as const

export function SiteHeader() {
  const pathname = usePathname()

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.jpeg"
            alt="Tarzan's Barbershop"
            width={40}
            height={40}
            className="rounded-full"
            priority
          />
          <span className="hidden sm:inline font-display text-lg tracking-[0.2em] text-gold">
            TARZAN&apos;S
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              data-active={isActive(item.href)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
