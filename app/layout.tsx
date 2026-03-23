import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import NavClock from '@/components/NavClock'
import NavLinks from '@/components/NavLinks'
import { getSiteUrl } from '@/lib/site'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-mono',
})

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: {
    default: 'AI RADAR — 全球 AI 资讯聚合平台',
    template: '%s | AI RADAR',
  },
  description: '每日聚合分析全球最重要的 AI 资讯，帮助 AI 从业者在 3 分钟内掌握行业动态',
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: 'AI RADAR',
    title: 'AI RADAR — 全球 AI 资讯聚合平台',
    description: '每日聚合分析全球最重要的 AI 资讯，帮助 AI 从业者在 3 分钟内掌握行业动态',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI RADAR — 全球 AI 资讯聚合平台',
    description: '每日聚合分析全球最重要的 AI 资讯，帮助 AI 从业者在 3 分钟内掌握行业动态',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body
        className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} font-body bg-white text-[#171717] min-h-screen`}
      >
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#EAEAEA]">
          <div className="max-w-[1200px] mx-auto px-6 h-20 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3.5">
              <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                <path d="M12 2L2 19.5h20L12 2z" fill="#000" />
              </svg>
              <div className="flex flex-col">
                <span className="font-mono font-bold text-xl tracking-[2px] text-black leading-tight">
                  AI RADAR
                </span>
                <span className="text-[0.7rem] text-[#999] leading-tight">
                  Global AI insights, delivered daily
                </span>
              </div>
            </Link>
            <NavLinks />
            <NavClock />
          </div>
        </nav>
        <main className="max-w-[1200px] mx-auto px-6 py-8">
          {children}
        </main>
        <footer className="text-center py-8 text-[#999] text-xs border-t border-[#EAEAEA] mt-8">
          AI RADAR — Global AI insights, delivered daily
        </footer>
      </body>
    </html>
  )
}
