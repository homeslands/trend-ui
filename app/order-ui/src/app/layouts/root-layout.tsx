import { Outlet } from 'react-router-dom'
import { NotificationProvider } from '@/components/app/notification-provider'
import { DialogProvider } from '@/contexts/dialog-context'

/**
 * Root Layout - Wrapper cho tất cả routes
 * Chứa NotificationProvider và DialogProvider để dùng chung cho toàn app
 */
export default function RootLayout() {
  return (
    <DialogProvider>
      <NotificationProvider />
      <Outlet />
    </DialogProvider>
  )
}

