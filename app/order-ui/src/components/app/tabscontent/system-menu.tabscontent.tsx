import SystemMenus from '@/app/system/menu/components/system-menus'
import { IGroupedMenuItem } from '@/types'

export function SystemMenuTabscontent({ groupedItems, isLoading }: { groupedItems: IGroupedMenuItem[], isLoading?: boolean }) {

  return (
    <div
      className={`flex flex-col w-full`}
    >
      <SystemMenus groupedItems={groupedItems} isLoading={isLoading} />
    </div>
  )
}
