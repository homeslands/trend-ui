import { useMemo, useState } from 'react'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'

import { Button, DataTable } from '@/components/ui'
import { ROUTE } from '@/constants'
import { useUserSpendingColumns, SpendingRow } from '@/app/system/customers/DataTable/columns'

import { buildSpendingCsv } from './spending-csv'

interface CustomerSpendingTableProps {
  rows: SpendingRow[]
  isLoading: boolean
}

const DEFAULT_PAGE_SIZE = 10

export default function CustomerSpendingTable({ rows, isLoading }: CustomerSpendingTableProps) {
  const { t } = useTranslation('customer')
  const navigate = useNavigate()
  const columns = useUserSpendingColumns()

  // `DataTable` (components/ui/data-table.tsx) khởi tạo sorting bằng
  // `useState<SortingState>([])` nội bộ — không có prop nào để seed sort mặc định.
  // Bảng cũ mặc định sort `totalAmount` giảm dần, nên để giữ hành vi đó ta SẮP XẾP SẴN
  // `rows` trước khi đưa vào `DataTable`; người dùng vẫn bấm sort lại được qua header
  // cột (`DataTableColumnHeader`) như bình thường.
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => b.totalAmount - a.totalAmount),
    [rows],
  )

  // `DataTable` luôn set `manualPagination: true` trong `useReactTable` của nó — kể cả
  // khi không truyền `pageIndex`/`pageSize` — nên `getPaginationRowModel()` của
  // @tanstack/react-table bỏ qua việc tự cắt trang (xem
  // node_modules/@tanstack/table-core/src/features/RowPagination.ts:
  // `if (manualPagination || !_getPaginationRowModel) return getPrePaginationRowModel()`).
  // Nói cách khác `DataTable` KHÔNG tự phân trang phía client dù bỏ trống
  // pageIndex/pageSize. Mẫu phân trang client-side đã có sẵn trong repo (xem
  // app/system/home/components/revenue-detail-table.tsx và
  // card-order-revenue.table.tsx): tự giữ `page`/`pageSize` local, tự cắt mảng, rồi
  // truyền phần đã cắt vào `data` cùng `pages` tính từ độ dài mảng gốc. Làm tương tự ở
  // đây — không truyền `pageIndex`/`pageSize` (props phân trang "controlled") cho
  // `DataTable`, chỉ dùng `onPageChange`/`onPageSizeChange`.
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const pages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  // Kẹp về trang hợp lệ cuối cùng nếu `rows` co lại (đổi bộ lọc) khiến `page` hiện tại
  // vượt quá số trang mới — tránh hiện trang trống một cách khó hiểu.
  const safePage = Math.min(page, pages)
  const pagedRows = useMemo(
    () => sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sortedRows, safePage, pageSize],
  )

  const isPageValid = (candidatePage: number, size: number) =>
    candidatePage >= 1 && candidatePage <= Math.max(1, Math.ceil(sortedRows.length / size))

  const handlePageChange = (newPage: number) => {
    if (isPageValid(newPage, pageSize)) setPage(newPage)
  }
  const handlePageSizeChange = (newPageSize: number) => {
    if (isPageValid(page, newPageSize)) setPageSize(newPageSize)
  }

  const handleRowClick = (row: SpendingRow) => {
    navigate(`${ROUTE.STAFF_CUSTOMER_MANAGEMENT}/${row.customerSlug}`)
  }

  // Xuất CSV luôn dựa trên TOÀN BỘ `rows` (không phải `pagedRows` của trang đang xem) —
  // file export phải chứa mọi khách trong kỳ đang phân tích, không chỉ trang hiện tại.
  const SpendingActionOptions = useMemo(() => {
    return function ActionOptions() {
      const handleExport = () => {
        const headers = [
          t('customer.analytics.colCustomer'),
          t('customer.analytics.colRegisteredAt'),
          t('customer.analytics.colTotal'),
          t('customer.analytics.colBank'),
          t('customer.analytics.colCash'),
          t('customer.analytics.colPoint'),
          t('customer.analytics.colCredit'),
        ]
        // U+FEFF = BOM, để Excel nhận đúng UTF-8 (tên khách có dấu tiếng Việt).
        const blob = new Blob(['﻿' + buildSpendingCsv(rows, headers)], {
          type: 'text/csv;charset=utf-8;',
        })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute(
          'download',
          `${t('customer.analytics.csvFileName')}-${moment().format('DD-MM-YYYY')}.csv`,
        )
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      }

      return (
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!rows.length}>
          <Download className="mr-2 w-4 h-4" />
          {t('customer.analytics.exportCsv')}
        </Button>
      )
    }
  }, [rows, t])

  return (
    <DataTable
      columns={columns}
      data={pagedRows}
      isLoading={isLoading}
      pages={pages}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
      onRowClick={handleRowClick}
      actionOptions={SpendingActionOptions}
      hiddenInput
    />
  )
}
