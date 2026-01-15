import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Authorize.net v2',
  description: 'Authorize.net integration application',
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
