import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib'
import { DownloadProgress } from '@/components/app/progress'
import { useDownloadStore, usePaymentMethodStore, useUserStore } from '@/stores'
import { ClientHeader, ClientFooter, BackToTop, BottomBarStatic } from './components'
import { Role, ROUTE } from '@/constants'
import { useSyncTableFromUrl } from '@/hooks/use-sync-table-from-url'

export default function PublicClientLayout() {
  const isMobile = useIsMobile()
  const { progress, fileName, isDownloading } = useDownloadStore()
  const location = useLocation()
  const { clearStore } = usePaymentMethodStore()
  const { userInfo } = useUserStore();
  const navigate = useNavigate()

  useSyncTableFromUrl()

  useEffect(() => {
    // Don't clear payment store when on any payment page (client or staff)
    const isOnPaymentPage = location.pathname.startsWith(ROUTE.CLIENT_PAYMENT) ||
      location.pathname.startsWith(ROUTE.STAFF_ORDER_PAYMENT)

    if (!isOnPaymentPage) {
      clearStore()
    }
    if (userInfo && userInfo.role.name !== Role.CUSTOMER) {
      navigate(ROUTE.LOGIN)
    }
  }, [location.pathname, clearStore, userInfo, navigate])

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <ClientHeader />

      {/* Main content */}
      <main className={cn(
        'flex-grow',
        isMobile ? 'pb-16 pb-[calc(4rem+env(safe-area-inset-bottom))]' : ''
      )}>
        <Outlet />
        {isDownloading && (
          <DownloadProgress progress={progress} fileName={fileName} />
        )}
        {/* <MessengerChat /> */}
        <BackToTop />
      </main>

      {/* Footer */}
      {isMobile && <BottomBarStatic />}
      <ClientFooter />
    </div>
  )
}
