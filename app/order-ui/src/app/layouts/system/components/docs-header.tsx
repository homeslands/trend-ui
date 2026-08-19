import {
  SettingsDropdown,
  SystemProfileDropdown,
} from '@/components/app/dropdown'
import { SystemNotificationPopover } from '@/components/app/popover'
import { CartDrawer } from '@/components/app/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib'

export function DocsHeader() {
  const isMobile = useIsMobile()
  
  return (
    <header className={cn(
      'sticky top-0 z-20 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60',
      isMobile && 'pt-[env(safe-area-inset-top)]'
    )}>
      <div className="flex items-center justify-end h-14">
        {/* <SidebarTrigger /> */}
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
