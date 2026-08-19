import { SidebarTrigger } from '@/components/ui'
import {
  SettingsDropdown,
  SystemProfileDropdown,
} from '@/components/app/dropdown'
import { SystemNotificationPopover } from '@/components/app/popover'
import { CartDrawer } from '@/components/app/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib'

export function AppHeader() {
  const isMobile = useIsMobile()
  
  return (
    <header
      className={cn(
        'sticky top-0 z-30 w-full text-muted-foreground shadow-md backdrop-blur-lg',
        isMobile && 'pt-[env(safe-area-inset-top)]'
      )}
    >
      <div className="flex h-14 items-center justify-between pr-3">
        <SidebarTrigger />
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <SystemNotificationPopover />

          {/* Settings */}
          <SettingsDropdown />

          <CartDrawer className="lg:hidden" />

          {/* User */}
          <SystemProfileDropdown />
        </div>
      </div>
    </header>
  )
}
