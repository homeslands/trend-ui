import { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import moment from 'moment'

import { IPointTransaction } from '@/types'
import { formatCurrency } from '@/utils'
import { PointTransactionType } from '@/constants'

export const usePointTransactionColumns = (props: { page: number, size: number }): ColumnDef<IPointTransaction>[] => {
  const { t } = useTranslation(['giftCard', 'common'])
  const { t: tProfile } = useTranslation('profile')
  const { page, size } = props;

  return [
    {
      accessorKey: 'index',
      header: () => <div className="font-semibold text-center text-black dark:text-white">{t('giftCard.pointTransaction.index')}</div>,
      cell: ({ row }) => {
        const currIndex = (page - 1) * size + (row?.index ?? 0) + 1;
        return (
          <div
            className="w-12 text-sm text-center text-gray-700 dark:text-gray-300"
          >
            {currIndex}
          </div>
        )
      },
    },
    {
      accessorKey: 'customerName',
      header: () => <div className="font-semibold text-center text-black dark:text-white">{t('giftCard.pointTransaction.customerName')}</div>,
      cell: ({ row }) => {
        const rowData = row.original
        const fullName = `${rowData?.user?.firstName ?? ''} ${rowData?.user?.lastName ?? ''}`.trim()
        return (
          <div
            className="w-44 max-w-44 truncate text-sm text-left text-gray-900 dark:text-white"
            title={fullName || undefined}
          >
            {fullName || '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'phonenumber',
      header: () => <div className="font-semibold text-center text-black dark:text-white">{t('giftCard.pointTransaction.phonenumber')}</div>,
      cell: ({ row }) => {
        const rowData = row.original
        const phonenumber = rowData?.user?.phonenumber
        return (
          <div
            className="w-32 max-w-32 truncate text-center text-gray-700 tabular-nums dark:text-gray-300"
            title={phonenumber ?? undefined}
          >
            {phonenumber || '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'type',
      header: () => <div className="font-semibold text-center text-black dark:text-white">{t('giftCard.pointTransaction.type')}</div>,
      cell: ({ row }) => {
        const rowData = row.original
        const isIn = rowData?.type === PointTransactionType.IN
        return (
          <div className="w-32 text-center">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${isIn
                ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                }`}
            >
              {isIn ? '▲' : '▼'} {isIn ? tProfile('profile.coinEarned') : tProfile('profile.coinSpent')}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: 'desc',
      header: () => <div className="font-semibold text-center text-black dark:text-white">{t('giftCard.pointTransaction.source')}</div>,
      cell: ({ row }) => {
        const rowData = row.original
        return (
          <div className="w-48 text-sm text-left text-gray-700 truncate dark:text-gray-300" title={rowData?.desc}>
            {rowData?.desc || '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'points',
      header: () => <div className="font-semibold text-center text-black dark:text-white">{t('giftCard.pointTransaction.points')}</div>,
      cell: ({ row }) => {
        const rowData = row.original;
        const total = rowData?.points as number;
        const isIn = rowData?.type === PointTransactionType.IN
        const className = isIn ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
        return (
          <div className={`w-32 text-sm font-bold text-right tabular-nums ${className}`} >
            {isIn ? '+' : '-'}
            {formatCurrency(total, '')}
          </div>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: () => <div className="font-semibold text-center text-black dark:text-white">{t('giftCard.pointTransaction.createdAt')}</div>,
      cell: ({ row }) => {
        const rowData = row.original
        return (
          <div className="w-44 text-sm text-gray-700 tabular-nums dark:text-gray-300">
            {moment(rowData.createdAt).format('HH:mm:ss DD/MM/YYYY')}
          </div>
        )
      },
    },
  ]
}
