import moment from 'moment'
import { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import {
  DataTableColumnHeader,
  Checkbox,
} from '@/components/ui'
import { IUserInfo } from '@/types'

interface UserColumnsProps {
  onSelectionChange?: (selectedSlug: string | null) => void
  selectedUser?: string | null
}

export const useUserColumns = ({
  onSelectionChange,
  selectedUser = null,
}: UserColumnsProps = {}): ColumnDef<IUserInfo>[] => {
  const { t } = useTranslation(['customer'])
  const { t: tCommon } = useTranslation('common')

  return [
    {
      id: 'select',
      header: () => <div className="text-sm font-medium">{tCommon('common.select')}</div>,
      cell: ({ row, table }) => {
        const user = row.original
        const isSelected = selectedUser === user.slug

        // Sync table state với selectedUser - tìm row index và sync nếu cần
        const currentRowIndex = table.getRowModel().rows.findIndex(r => r.id === row.id)
        const currentTableSelection = table.getState().rowSelection
        const isRowSelectedInTable = currentRowIndex >= 0 && currentTableSelection[currentRowIndex] === true

        // Sync table state một cách an toàn - chỉ khi thực sự cần thiết
        if (currentRowIndex >= 0) {
          if (isSelected && !isRowSelectedInTable) {
            // User được chọn nhưng table state chưa sync
            // Sử dụng requestAnimationFrame để sync sau khi render xong
            requestAnimationFrame(() => {
              table.setRowSelection({ [currentRowIndex]: true })
            })
          } else if (!isSelected && isRowSelectedInTable) {
            // User không được chọn nhưng table state vẫn selected
            requestAnimationFrame(() => {
              const newSelection = { ...currentTableSelection }
              delete newSelection[currentRowIndex]
              table.setRowSelection(newSelection)
            })
          }
        }

        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={(value) => {
                // Single selection: nếu check thì chọn user này, nếu uncheck thì bỏ chọn
                if (value) {
                  // Chọn user mới - clear tất cả selection trước
                  onSelectionChange?.(user.slug)
                  // Sync table state ngay lập tức - chỉ select row hiện tại
                  const rowIndex = table.getRowModel().rows.findIndex(r => r.id === row.id)
                  if (rowIndex >= 0) {
                    // Clear tất cả selection trước, sau đó select row hiện tại
                    table.setRowSelection({ [rowIndex]: true })
                  }
                } else {
                  // Bỏ chọn user
                  onSelectionChange?.(null)
                  // Clear table selection
                  table.setRowSelection({})
                }
              }}
              aria-label="Select user"
            />
          </div>
        )
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.createdAt')} />
      ),
      cell: ({ row }) => {
        const createdAt = row.getValue('createdAt')
        return (
          <div className="text-sm">
            {createdAt ? moment(createdAt).format('HH:mm DD/MM/YYYY') : ''}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.status')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        return <div className={`text-sm ${user?.isActive ? 'text-green-500' : 'text-destructive'}`}>{user?.isActive ? t('customer.active') : t('customer.inactive')}</div>
      },
    },
    {
      accessorKey: 'slug',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.slug')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        return <div className="text-sm">{user?.slug}</div>
      },
    },
    {
      accessorKey: 'fullname',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.name')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="text-sm">
            {user?.firstName} {user?.lastName}
          </div>
        )
      },
    },
    {
      accessorKey: 'phoneNumber',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.phoneNumber')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        return <div className="text-sm">{user?.phonenumber}</div>
      },
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('customer.email')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        return <div className="text-sm">{user?.email}</div>
      },
    },
  ]
}

