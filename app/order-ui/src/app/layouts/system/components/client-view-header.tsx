import { Logo } from '@/assets/images'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib'

export function ClientViewHeader() {
  const isMobile = useIsMobile()
  
  return (
    <header
      className={cn(
        'sticky top-0 z-30 w-full shadow-md backdrop-blur-lg text-muted-foreground',
        isMobile && 'pt-[env(safe-area-inset-top)]'
      )}
    >
      <div className="container flex justify-center items-center pr-3 h-14">
        <div className="flex gap-2 items-center">
          <h1 className="text-2xl font-bold">
            {<img src={Logo} alt="logo" className="h-8 w-fit" />}
          </h1>
        </div>
      </div>
    </header>
  )
}
