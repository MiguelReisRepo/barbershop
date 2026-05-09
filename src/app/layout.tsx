import type { Metadata } from "next"
import { Cinzel, Inter } from "next/font/google"
import "./globals.css"
import { SiteHeader } from "@/components/SiteHeader"
import { SiteFooter } from "@/components/SiteFooter"

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
})

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Tarzan's Barbershop — Marcações em Lisboa e Setúbal",
  description:
    "Barbearia clássica em Lisboa e Setúbal. Cortes precisos, atendimento meticuloso e agenda online com confirmação imediata.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-PT"
      className={`${cinzel.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SiteHeader />
        {/* min-h-[100vh] forces page content to fill viewport so the policies/footer
            section requires a deliberate scroll, even on tall monitors */}
        <div className="flex-1 min-h-[100vh]">{children}</div>
        <SiteFooter />
      </body>
    </html>
  )
}
