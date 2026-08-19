import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

import { cn } from '@/lib'
import { useDownloadStore, usePaymentMethodStore, useUserStore } from '@/stores'
import { DownloadProgress } from '@/components/app/progress'
import { ChooseBranchDialog } from '@/components/app/dialog'
import { Role, ROUTE } from '@/constants'
import { useSyncTableFromUrl } from '@/hooks/use-sync-table-from-url'

export default function ClientLayout() {
  const { progress, fileName, isDownloading } = useDownloadStore()
  const { clearStore } = usePaymentMethodStore()
  const { userInfo } = useUserStore()
  const navigate = useNavigate()
  const location = useLocation()

  useSyncTableFromUrl()

  useEffect(() => {
    const isOnPaymentPage =
      location.pathname.startsWith(ROUTE.CLIENT_PAYMENT) ||
      location.pathname.startsWith(ROUTE.STAFF_ORDER_PAYMENT)

    if (!isOnPaymentPage) clearStore()

    if (userInfo && userInfo.role?.name !== Role.CUSTOMER) {
      navigate(ROUTE.LOGIN)
    }
  }, [location.pathname, clearStore, userInfo, navigate])

  return (
    <main className={cn('flex-grow bg-muted-foreground/10')}>
      <ChooseBranchDialog />
      <Outlet />
      {isDownloading && <DownloadProgress progress={progress} fileName={fileName} />}
    </main>
  )
}
