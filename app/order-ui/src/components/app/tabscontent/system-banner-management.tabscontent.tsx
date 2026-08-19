import { useMemo } from 'react'
import moment from 'moment'

import { DataTable } from '@/components/ui'
import { useBanners } from '@/hooks'
import { useBannerColumns } from '@/app/system/banner/DataTable/columns'
import { BannerActionOptions } from '@/app/system/banner/DataTable/actions'

export function SystemBannerManagementTabsContent() {
  const { data, isLoading } = useBanners()

  // Sort dữ liệu banner theo createdAt từ mới nhất -> cũ nhất
  const sortedBanners = useMemo(() => {
    if (!data?.result || data.result.length === 0) return []
    
    return [...data.result].sort((a, b) => {
      const dateA = moment(a.createdAt).valueOf()
      const dateB = moment(b.createdAt).valueOf()
      return dateB - dateA // Mới nhất -> cũ nhất (DESC)
    })
  }, [data?.result])

  return (
    <div className="grid h-full grid-cols-1 gap-2">
      <DataTable
        columns={useBannerColumns()}
        data={sortedBanners}
        isLoading={isLoading}
        pages={1}
        onPageChange={() => { }}
        onPageSizeChange={() => { }}
        actionOptions={BannerActionOptions}
      />
    </div>
  )
}

