import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'City Computer College - Fee Management System',
  description: 'Fee management system for City Computer College',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}