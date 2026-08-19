import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { DataTable } from '@/components/ui'
import { useVoucherGroupColumns } from '@/app/system/voucher/DataTable/columns'
import { usePagination, useVoucherGroups } from '@/hooks'
import { VoucherGroupAction } from '@/app/system/voucher/DataTable/actions'
import { ROUTE } from '@/constants'

export function SystemVoucherManagementTabsContent() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page')) || 1
  const size = Number(searchParams.get('size')) || 10
  const { handlePageChange, handlePageSizeChange, pagination } = usePagination()
  
  // add page size to query params
  useEffect(() => {
    setSearchParams((prev) => {
      prev.set('page', pagination.pageIndex.toString())
      prev.set('size', pagination.pageSize.toString())
      return prev
    })
  }, [pagination.pageIndex, pagination.pageSize, setSearchParams])

  const { data, isLoading } = useVoucherGroups({
    page,
    size,
    hasPaging: true
  })

  const handleVoucherGroupClick = (slug: string) => {
    navigate(`${ROUTE.STAFF_CUSTOMER_AND_MARKETING_VOUCHER_GROUP}/${slug}`)
  }

  return (
    <div className="grid grid-cols-1 gap-2 h-full">
      <DataTable
        columns={useVoucherGroupColumns()}
        data={data?.result.items || []}
        isLoading={isLoading}
        pages={data?.result.totalPages || 1}
        hiddenInput={true}
        onRowClick={(row) => handleVoucherGroupClick(row.slug)}
        actionOptions={VoucherGroupAction}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}

