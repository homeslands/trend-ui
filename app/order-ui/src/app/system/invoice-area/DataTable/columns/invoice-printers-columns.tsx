import { useMemo } from 'react'
import moment from 'moment'
import { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { DataTableColumnHeader, Switch } from '@/components/ui'
import { IPrinter } from '@/types'
import { useTogglePrinterForInvoiceArea } from '@/hooks'
import PrinterActions from '../actions/invoice-printer-action-options'

function ToggleCell({ printer, invoiceAreaSlug }: { printer: IPrinter; invoiceAreaSlug: string }) {
  const { mutate: toggle, isPending } = useTogglePrinterForInvoiceArea()
  return (
    <div className="flex items-center justify-center">
      <Switch
        checked={printer.isActive}
        disabled={isPending}
        onCheckedChange={(checked) =>
          toggle({ slug: invoiceAreaSlug, printerSlug: printer.slug, isActive: checked })
        }
      />
    </div>
  )
}

export const useInvoicePrintersColumns = (invoiceAreaSlug: string): ColumnDef<IPrinter>[] => {
  const { t } = useTranslation(['chefArea', 'common'])

  return useMemo(() => [
    {
      accessorKey: 'toggle',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('chefArea:printer.toggle')} />,
      cell: ({ row }) => <ToggleCell printer={row.original} invoiceAreaSlug={invoiceAreaSlug} />,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('common:common.createdAt')} />,
      cell: ({ row }) => <span>{moment(row.original.createdAt).format('HH:mm:ss DD/MM/YYYY')}</span>,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('chefArea:printer.name')} />,
    },
    {
      accessorKey: 'ip',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('chefArea:printer.ip')} />,
    },
    {
      accessorKey: 'port',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('chefArea:printer.port')} />,
    },
    {
      accessorKey: 'dataType',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('chefArea:printer.dataType')} />,
      cell: ({ row }) => <span>{row.original.dataType.toUpperCase()}</span>,
    },
    {
      accessorKey: 'printerId',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('chefArea:printer.printerId')} />,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('chefArea:printer.status')} />,
      cell: ({ row }) => (
        <span className={row.original.isActive ? 'text-green-500' : 'text-destructive'}>
          {row.original.isActive ? t('chefArea:printer.active') : t('chefArea:printer.inactive')}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => <PrinterActions printer={row.original} invoiceAreaSlug={invoiceAreaSlug} />,
    },
  ], [t, invoiceAreaSlug])
}
