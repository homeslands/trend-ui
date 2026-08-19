import { DataTable } from '@/components/ui'
import { usePromotionColumns } from '@/app/system/promotion/DataTable/columns'
import { usePagination, usePromotions } from '@/hooks'
import { PromotionAction } from '@/app/system/promotion/DataTable/actions'
import { useUserStore } from '@/stores'

export function SystemPromotionManagementTabsContent() {
  const { handlePageChange, handlePageSizeChange } = usePagination()
  const { userInfo } = useUserStore()
  const { data, isLoading } = usePromotions(userInfo?.branch?.slug || '')

  return (
    <div className="grid grid-cols-1 gap-2 h-full">
      <DataTable
        columns={usePromotionColumns()}
        data={data?.result?.items || []}
        isLoading={isLoading}
        pages={1}
        hiddenInput={true}
        actionOptions={PromotionAction}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}

