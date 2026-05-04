import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { AppSidebar } from '../components/AppSidebar'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  )
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <AppHeader onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        autoCloseOnNavigate={isMobile}
      />
      <main className={`app-main${sidebarOpen ? ' sidebar-open' : ''}`}>
        <Outlet />
      </main>
    </div>
  )
}
