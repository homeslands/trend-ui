import { useMemo } from 'react'
import moment from 'moment'
import { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal, Trash2 } from 'lucide-react'

import {
  Button,
  DataTableColumnHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui'
import { UpdateInvoiceAreaSheet } from '@/components/app/sheet'
import { IInvoiceArea } from '@/types'

export const useInvoiceAreaColumns = (
  onDelete: (slug: string) => void,
): ColumnDef<IInvoiceArea>[] => {
  const { t } = useTranslation(['chefArea', 'common'])

  return useMemo(
    () => [
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('common:common.createdAt')} />
        ),
        cell: ({ row }) => (
          <span>{moment(row.original.createdAt).format('HH:mm:ss DD/MM/YYYY')}</span>
        ),
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('chefArea:invoiceArea.name')} />
        ),
      },
      {
        accessorKey: 'description',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('chefArea:invoiceArea.description')} />
        ),
      },
      {
        id: 'actions',
        header: t('common:common.action'),
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-8 h-8 p-0">
                  <span className="sr-only">{t('common:common.action')}</span>
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="flex flex-col gap-1">
                <DropdownMenuLabel>{t('common:common.action')}</DropdownMenuLabel>
                <UpdateInvoiceAreaSheet area={row.original} />
                <Button
                  variant="ghost"
                  className="gap-1 px-2 text-sm text-destructive bg-destructive/10 hover:bg-destructive/10 hover:text-destructive justify-start w-full"
                  onClick={() => onDelete(row.original.slug)}
                >
                  <Trash2 size="icon" />
                  {t('common:common.delete')}
                </Button>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [t, onDelete],
  )
}
