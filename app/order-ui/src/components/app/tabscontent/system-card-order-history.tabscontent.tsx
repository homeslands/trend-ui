import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useExportExcel, usePagination, useQueryCardOrders } from '@/hooks'
import { DataTable } from '@/components/ui'
import { CardOrderStatus, SortOperation } from '@/constants'
import { SortContext } from '@/contexts'
import moment from 'moment'
import CardOrderDetailSheet from '@/components/app/sheet/card-order-detail-sheet'
import { ICardOrderGetRequest, ICardOrderResponse } from '@/types'
import CardOrderAction from '@/app/system/card-order-history/DataTable/actions/card-order-action'
import { useCardOrderColumns } from '@/app/system/card-order-history/DataTable/columns/card-order-columns'
import { saveAs } from 'file-saver'
import { useTranslation } from 'react-i18next'

export interface IFilterProps {
  startDate?: string;
  endDate?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  status?: any;
  k: string | null;
  pm: string
}

const defaultFilter: IFilterProps = {
  startDate: moment().format("YYYY-MM-DD"),
  endDate: moment().format("YYYY-MM-DD"),
  status: 'all',
  pm: 'all',
  k: null
}

export function SystemCardOrderTabContent() {
  const { t } = useTranslation('giftCard')
  const [searchParams, setSearchParams] = useSearchParams()
  const { pagination, handlePageChange, handlePageSizeChange } = usePagination()
  const [sortField, setSortField] = useState('createdAt,desc')
  const [filter, setFilter] = useState<IFilterProps>(
    defaultFilter);

  const [selectedRow, setSelectedRow] = useState<ICardOrderResponse | null>(null);

  const page = Number(searchParams.get('page')) || 1
  const size = Number(searchParams.get('size')) || 10

  const { mutate: exportExcelMutation } = useExportExcel();

  const buildPayload = () => {
    let payload: ICardOrderGetRequest = {
      page,
      size,
      sort: sortField,
      status: filter.status === CardOrderStatus.ALL ? null : filter.status,
      // toDate: filter?.endDate,
      k: filter.k,
      paymentMethod: filter.pm === 'all' ? null : filter.pm,
    }

    if (filter.startDate) {
      payload = {
        ...payload,
        fromDate: filter?.startDate,
      }
    }

    if (filter.endDate) {
      payload = {
        ...payload,
        toDate: filter?.endDate,
      }
    }
    return payload;
  }

  const { data, isLoading, refetch } = useQueryCardOrders(buildPayload())

  const cardOrders = data?.result.items || []

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



  const handleRefresh = () => {
    handlePageChange(1)
    refetch()
  }

  const handleDateChange = useCallback((startDate: string, endDate: string) => {
    setFilter(prev => {
      return {
        ...prev,
        startDate,
        endDate
      }
    })
  }, [])

  const handleStatusChange = useCallback((v: string) => {
    setFilter(prev => (prev.status === v ? prev : { ...prev, status: v }));
  }, []);

  const handleExportExcel = useCallback(() => {
    const ITEM_MAX = 1000000;
    const params = {
      page: 1,
      size: ITEM_MAX,
      sort: sortField,
      status: filter.status === CardOrderStatus.ALL ? null : filter.status,
      fromDate: filter?.startDate,
      toDate: filter?.endDate,
      k: filter.k,
      paymentMethod: filter.pm === 'all' ? null : filter.pm,
    }
    exportExcelMutation(params, {
      onSuccess: (data) => {
        saveAs(data.blob, data.filename);
      },
    })
  }, [filter.k, filter.pm, filter.startDate, filter.endDate, filter.status]);

  const handleSearch = useCallback((k?: string) => {
    setFilter(prev => {
      return {
        ...prev,
        k: k || null
      }
    })
  }, [])

  const handlePMChange = useCallback((v: string) => {
    setFilter(prev => (prev.pm === v ? prev : { ...prev, pm: v }));
  }, []);

  const renderAction = useCallback(() => (
    <CardOrderAction
      pm={filter.pm}
      disabled={cardOrders.length === 0}
      status={filter.status}
      onSelectChange={handleStatusChange}
      onExportExcel={handleExportExcel}
      onPMSelectChange={handlePMChange}
    />
  ), [cardOrders.length, filter.status, filter.pm]);

  return (
    <div className="mt-4">
      <SortContext.Provider value={{ onSort: handleSortChange }}>
        <DataTable
          searchPlaceholder={t(`giftCard.cardOrder.searchPlaceholder`)}
          hiddenInput={false}
          onInputChange={handleSearch}
          columns={useCardOrderColumns()}
          data={cardOrders}
          isLoading={isLoading}
          pages={data?.result.totalPages || 0}
          hiddenDatePicker={false}
          actionOptions={renderAction}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onRefresh={handleRefresh}
          onDateChange={handleDateChange}
          onRowClick={(row) => {
            setSelectedRow(row)
          }}

        />
      </SortContext.Provider>
      <CardOrderDetailSheet data={selectedRow} isOpen={selectedRow ? true : false} onClose={() => setSelectedRow(null)} />
    </div>
  )
}
