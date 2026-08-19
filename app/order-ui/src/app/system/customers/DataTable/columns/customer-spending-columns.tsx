import { useMemo } from 'react'
import moment from 'moment'
import { ColumnDef, Column } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { DataTableColumnHeader } from '@/components/ui'
import { ICustomerAccountRevenue } from '@/types'
import { formatCurrency } from '@/utils'

export type SpendingRow = ICustomerAccountRevenue['customers'][number]

const money = (v: number) => (
  <div className="text-sm text-right tabular-nums">{formatCurrency(v)}</div>
)

// Cột số căn PHẢI cả header lẫn cell (chuẩn data-table cho cột numeric). Cell dùng
// `text-right`; header là `DataTableColumnHeader` (flex `items-center`, mặc định dồn
// trái) nên phải truyền `justify-end` để nhãn + nút sort dồn về phải, thẳng hàng với số.
const numericHeader =
  (title: string) =>
  ({ column }: { column: Column<SpendingRow, unknown> }) => (
    <DataTableColumnHeader column={column} title={title} className="justify-end" />
  )

export const useUserSpendingColumns = (): ColumnDef<SpendingRow>[] => {
  const { t } = useTranslation('customer')
  return useMemo<ColumnDef<SpendingRow>[]>(
    () => [
      {
        accessorKey: 'customerName',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('customer.analytics.colCustomer')} />
        ),
        cell: ({ row }) => <div className="text-sm min-w-36">{row.original.customerName}</div>,
      },
      {
        accessorKey: 'customerRegisteredAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('customer.analytics.colRegisteredAt')} />
        ),
        cell: ({ row }) => (
          <div className="w-28 text-sm text-muted-foreground tabular-nums">
            {row.original.customerRegisteredAt
              ? moment(row.original.customerRegisteredAt).format('DD/MM/YYYY')
              : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'totalAmount',
        header: numericHeader(t('customer.analytics.colTotal')),
        cell: ({ row }) => (
          <div className="text-sm font-semibold text-right tabular-nums">
            {formatCurrency(row.original.totalAmount)}
          </div>
        ),
      },
      {
        accessorKey: 'totalAmountBank',
        header: numericHeader(t('customer.analytics.colBank')),
        cell: ({ row }) => money(row.original.totalAmountBank),
      },
      {
        accessorKey: 'totalAmountCash',
        header: numericHeader(t('customer.analytics.colCash')),
        cell: ({ row }) => money(row.original.totalAmountCash),
      },
      {
        accessorKey: 'totalAmountPoint',
        header: numericHeader(t('customer.analytics.colPoint')),
        cell: ({ row }) => money(row.original.totalAmountPoint),
      },
      {
        accessorKey: 'totalAmountCreditCard',
        header: numericHeader(t('customer.analytics.colCredit')),
        cell: ({ row }) => money(row.original.totalAmountCreditCard),
      },
    ],
    [t],
  )
}
