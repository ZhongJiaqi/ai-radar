import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import NavClock from '@/components/NavClock'

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

const siteUrl = 'https://ai-radar.dev'

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
          <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                <path d="M12 2L2 19.5h20L12 2z" fill="#000" />
              </svg>
              <span className="font-mono font-bold text-sm tracking-[2px] text-black">
                AI RADAR
              </span>
            </a>
            <ul className="hidden md:flex items-center gap-6">
              <li>
                <a href="/" className="text-sm text-[#666] hover:text-black transition-colors">
                  今日速递
                </a>
              </li>
              <li>
                <a href="/digest" className="text-sm text-[#666] hover:text-black transition-colors">
                  每日简报
                </a>
              </li>
            </ul>
            <NavClock />
          </div>
        </nav>
        <main className="max-w-[1200px] mx-auto px-6 py-8">
          {children}
        </main>
        <footer className="text-center py-8 text-[#999] text-xs border-t border-[#EAEAEA] mt-8">
          AI RADAR — 全球AI资讯聚合平台 · 36个信源 · 每日3分钟速递
        </footer>
      </body>
    </html>
  )
}
