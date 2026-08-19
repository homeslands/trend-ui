import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useGetGiftCards, usePagination } from '@/hooks'
import { DataTable } from '@/components/ui'
import { SortOperation } from '@/constants'
import { SortContext } from '@/contexts'
import { useGiftCardListColumns } from '@/app/system/gift-card/DataTable/columns'
import { GiftCardAction } from '@/app/system/gift-card/DataTable/actions'

export interface IFilterProps {
  startDate?: string;
  endDate?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  status?: any;
}


export function SystemCardTabContent() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page')) || 1
  const size = Number(searchParams.get('size')) || 10
  const [sortField, setSortField] = useState('createdAt,desc')
  const { pagination, handlePageChange, handlePageSizeChange } = usePagination()

  // add page size to query params
  useEffect(() => {
    setSearchParams((prev) => {
      prev.set('page', pagination.pageIndex.toString())
      prev.set('size', pagination.pageSize.toString())
      return prev
    })
  }, [pagination.pageIndex, pagination.pageSize, setSearchParams])

  const handleSortChange = (operation: SortOperation) => {
    // Sort field updated based on operation type
    if (operation === SortOperation.CREATE) {
      setSortField('createdAt,desc')
    } else if (operation === SortOperation.UPDATE) {
      setSortField('updatedAt,desc')
    }
  }

  const { data: giftCardData, isLoading } = useGetGiftCards({
    page,
    size,
    sort: sortField,
    isActive: null,
  })

  const giftCards = giftCardData?.result.items || []

  return (
    <div className="mt-4">
      <SortContext.Provider value={{ onSort: handleSortChange }}>
        <DataTable
          columns={useGiftCardListColumns()}
          data={giftCards}
          isLoading={isLoading}
          pages={giftCardData?.result.totalPages || 0}
          actionOptions={GiftCardAction}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </SortContext.Provider>
    </div>
  )
}
