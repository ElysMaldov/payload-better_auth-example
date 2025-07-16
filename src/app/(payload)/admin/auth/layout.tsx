import { Providers } from '@/components/Providers'
import { ReactNode } from 'react'
import '../../../../globals.css'

export interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <html>
      <body className="flex items-center justify-center h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

export default Layout
