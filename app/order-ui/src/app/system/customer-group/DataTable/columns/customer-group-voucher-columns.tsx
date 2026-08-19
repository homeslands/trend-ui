import moment from 'moment'
import { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal, Copy } from 'lucide-react'

import {
  Button,
  DataTableColumnHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui'
import { IVoucher } from '@/types'
import { formatCurrency, showToast } from '@/utils'
import { ApplyVoucherSheet, ApplyVoucherForUserGroupSheet, RemoveAppliedVoucherSheet, UpdateVoucherPaymentMethodSheet, UpdateVoucherSheet, RemoveAppliedVoucherForUserGroupSheet } from '@/components/app/sheet'
import { VOUCHER_TYPE } from '@/constants'

export const useCustomerGroupVoucherColumns = (onSuccess: () => void): ColumnDef<IVoucher>[] => {
  const { t } = useTranslation(['voucher'])
  const { t: tCommon } = useTranslation(['common'])
  const { t: tToast } = useTranslation('toast')

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    showToast(tToast('toast.copyCodeSuccess'))
  }

  const handleUpdateVoucherSuccess = () => {
    onSuccess()
  }

  return [
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.title')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        return (
          <div className="flex flex-col gap-1 w-[14rem]">
            {voucher?.title}
            {voucher?.description && (
              <span className="text-xs text-muted-foreground line-clamp-2">
                {voucher.description}
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'code',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.code')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        return (
          <div className="flex gap-2 items-center text-xs sm:text-sm">
            <span className="font-mono">{voucher?.code}</span>
            <div onClick={(e) => e.stopPropagation()}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6"
                      onClick={() => handleCopyCode(voucher?.code)}
                    >
                      <Copy className="w-4 h-4 text-primary" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('voucher.copyCode')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.type')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        return (
          <div className="text-xs sm:text-sm">
            {voucher?.type === VOUCHER_TYPE.FIXED_VALUE
              ? t('voucher.fixedValue')
              : voucher?.type === VOUCHER_TYPE.PERCENT_ORDER
                ? t('voucher.percentOrder')
                : t('voucher.samePrice')}
          </div>
        )
      },
    },
    {
      accessorKey: 'value',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.value')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        return (
          <div className="text-xs sm:text-sm">
            {voucher?.type === VOUCHER_TYPE.FIXED_VALUE
              ? formatCurrency(voucher?.value)
              : voucher?.type === VOUCHER_TYPE.PERCENT_ORDER
                ? `${voucher?.value}%`
                : formatCurrency(voucher?.value)}
          </div>
        )
      },
    },
    {
      accessorKey: 'startDate',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.time')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        return (
          <div className="text-xs min-w-[11rem] sm:text-sm">
            {moment(voucher?.startDate).format('DD/MM/YYYY')} -{' '}
            {moment(voucher?.endDate).format('DD/MM/YYYY')}
          </div>
        )
      },
    },
    {
      accessorKey: 'isActive',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.activeStatus')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        const isActive = voucher?.isActive === true
        return (
          <div
            className={`text-xs sm:text-sm font-medium ${isActive ? 'text-green-500' : 'text-destructive'}`}
          >
            {isActive ? t('voucher.active') : t('voucher.inactive')}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: tCommon('common.action'),
      cell: ({ row }) => {
        const voucher = row.original
        return (
          <div className="max-w-[1rem]" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="p-0 w-8 h-8">
                  <span className="sr-only">{tCommon('common.action')}</span>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="flex flex-col gap-1 w-fit">
                <DropdownMenuLabel>
                  {tCommon('common.action')}
                </DropdownMenuLabel>
                <ApplyVoucherSheet voucher={voucher} />
                {voucher?.customerType === 'group' && <ApplyVoucherForUserGroupSheet voucher={voucher} />}
                <RemoveAppliedVoucherSheet voucher={voucher} />
                {voucher?.customerType === 'group' && <RemoveAppliedVoucherForUserGroupSheet voucher={voucher} />}
                <UpdateVoucherSheet voucher={voucher} onSuccess={handleUpdateVoucherSuccess} />
                <UpdateVoucherPaymentMethodSheet voucher={voucher} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]
}
