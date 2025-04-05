import './globals.css'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'CyneticsIDE - AI-Powered Development Environment',
  description: 'Next-generation IDE with AI-powered features, real-time collaboration, and intelligent code assistance',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
          <div className="glass-container">
            {children}
          </div>
        </div>
        <Analytics />
      </body>
    </html>
  )
} 