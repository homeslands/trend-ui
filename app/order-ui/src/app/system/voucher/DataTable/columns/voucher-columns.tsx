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
  Checkbox,
} from '@/components/ui'
import { IVoucher } from '@/types'
import { formatCurrency, showToast } from '@/utils'
import { ApplyVoucherSheet, ApplyVoucherForUserGroupSheet, RemoveAppliedVoucherSheet, UpdateVoucherPaymentMethodSheet, UpdateVoucherSheet, RemoveAppliedVoucherForUserGroupSheet } from '@/components/app/sheet'
import { DeleteVoucherDialog } from '@/components/app/dialog'
import { VOUCHER_TYPE, VOUCHER_USAGE_FREQUENCY_UNIT, VOUCHER_CUSTOMER_TYPE } from '@/constants'

export const useVoucherColumns = (onSuccess: () => void, onSelectionChange: (selectedSlugs: IVoucher[]) => void, selectedVouchers: IVoucher[]): ColumnDef<IVoucher>[] => {
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

  const updateSelectedVouchers = (updatedSlugs: IVoucher[]) => {
    onSelectionChange?.(updatedSlugs)
  }

  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={selectedVouchers && selectedVouchers.length === table.getRowModel().rows.length}
          onCheckedChange={(value) => {
            table.toggleAllPageRowsSelected(!!value)
            const rows = table.getRowModel().rows
            const updatedSlugs = value ? rows.map((row) => row.original) : []
            updateSelectedVouchers(updatedSlugs)
          }}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selectedVouchers && selectedVouchers.some(v => v.slug === voucher.slug)}
              onCheckedChange={(value) => {
                row.toggleSelected(!!value)
                updateSelectedVouchers(
                  value ? [...selectedVouchers, voucher] : selectedVouchers && selectedVouchers.filter((v) => v.slug !== voucher.slug)
                )
              }}
              aria-label="Select row"
            />
          </div>
        )
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.title')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        return (
          <div className="flex flex-col gap-1 w-[16rem]">
            {voucher?.title}
            <span className="text-xs text-muted-foreground">
              {voucher.description}
            </span>
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
        return <div className="text-xs sm:text-sm">{voucher?.type === VOUCHER_TYPE.FIXED_VALUE ? t('voucher.fixedValue') : voucher?.type === VOUCHER_TYPE.PERCENT_ORDER ? t('voucher.percentOrder') : t('voucher.samePrice')}</div>
      },
    },
    {
      accessorKey: 'customerType',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.customerType')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        const customerType = voucher?.customerType
        
        if (customerType === VOUCHER_CUSTOMER_TYPE.ALL) {
          return <div className="text-xs sm:text-sm">{t('voucher.allCustomers')}</div>
        } else if (customerType === VOUCHER_CUSTOMER_TYPE.GROUP) {
          return <div className="text-xs sm:text-sm">{t('voucher.userGroup')}</div>
        } else if (customerType === VOUCHER_CUSTOMER_TYPE.PERSON) {
          return <div className="text-xs sm:text-sm">{t('voucher.singleUser')}</div>
        }
        
        return <div className="text-xs sm:text-sm">-</div>
      },
    },
    {
      accessorKey: 'usageFrequencyUnit',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.usageFrequencyUnit')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        if (voucher?.usageFrequencyUnit === 'unlimited' && voucher?.usageFrequencyValue === null) {
          return <div className="text-xs sm:text-sm">{t('voucher.unlimited')}</div>
        }
        return <div className="text-xs sm:text-sm">{voucher?.usageFrequencyUnit === VOUCHER_USAGE_FREQUENCY_UNIT.HOUR ? t('voucher.hour') : voucher?.usageFrequencyUnit === VOUCHER_USAGE_FREQUENCY_UNIT.DAY ? t('voucher.day') : voucher?.usageFrequencyUnit === VOUCHER_USAGE_FREQUENCY_UNIT.WEEK ? t('voucher.week') : voucher?.usageFrequencyUnit === VOUCHER_USAGE_FREQUENCY_UNIT.MONTH ? t('voucher.month') : t('voucher.year')}</div>
      },
    },
    {
      accessorKey: 'usageFrequencyValue',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.usageFrequencyValue')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        if (voucher?.usageFrequencyUnit === 'unlimited' && voucher?.usageFrequencyValue === null) {
          return <div className="text-xs sm:text-sm">-</div>
        }
        return <div className="text-xs sm:text-sm">{voucher?.usageFrequencyValue}</div>
      },
    },
    {
      accessorKey: 'maxItems',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.maxItems')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        return <div className="text-xs sm:text-sm">{voucher?.maxItems}</div>
      },
    },
    {
      accessorKey: 'private',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.privateType')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        return <div className="text-xs sm:text-sm">{voucher?.isPrivate ? t('voucher.private') : t('voucher.public')}</div>
      },
    },
    {
      accessorKey: 'verificationIdentity',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.verificationIdentityType')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        return <div className="text-xs sm:text-sm">{voucher?.isVerificationIdentity ? t('voucher.verificationIdentity') : t('voucher.noVerificationIdentity')}</div>
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
          <div className="text-xs min-w-[13rem] sm:text-sm">
            {moment(voucher?.startDate).format('HH:mm DD/MM/YYYY')} - {moment(voucher?.endDate).format('HH:mm DD/MM/YYYY')}
            {row.original.activeStartTime && (
              <span className="ml-1 rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">
                {row.original.activeStartTime}–{row.original.activeEndTime}
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
            {voucher?.code}
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
      accessorKey: 'maxUsage',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.maxUsage')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        return <div className="text-xs sm:text-sm">{voucher?.maxUsage}</div>
      },
    },
    {
      accessorKey: 'remainingUsage',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.remainingUsage')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        return <div className="text-xs sm:text-sm">{voucher?.remainingUsage}</div>
      },
    },
    {
      accessorKey: 'value',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.value')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        return <div className="text-xs sm:text-sm">
          {voucher?.type === VOUCHER_TYPE.FIXED_VALUE ? formatCurrency(voucher?.value) : voucher?.type === VOUCHER_TYPE.PERCENT_ORDER ? `${voucher?.value}%` : formatCurrency(voucher?.value)}
        </div>
      },
    },
    {
      accessorKey: 'isActive',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('voucher.activeStatus')} />
      ),
      cell: ({ row }) => {
        const voucher = row.original;
        const isActive = voucher?.isActive === true;

        return (
          <div
            className={`text-xs sm:text-sm min-w-[8rem] italic font-medium ${isActive ? 'text-green-500' : 'text-destructive'
              }`}
          >
            {isActive ? t('voucher.active') : t('voucher.inactive')}
          </div>
        );
      },
    },
    {
      accessorKey: 'minOrderValue',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('voucher.minOrderValue')}
        />
      ),
      cell: ({ row }) => {
        const voucher = row.original
        return (
          <div className="text-xs sm:text-sm">{formatCurrency(voucher?.minOrderValue)}</div>
        )
      },
    },
    {
      id: 'actions',
      header: tCommon('common.action'),
      cell: ({ row }) => {
        const voucher = row.original
        return (
          <div className='max-w-[1rem]' onClick={(e) => e.stopPropagation()}>
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
                <DeleteVoucherDialog voucher={voucher} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]
}
