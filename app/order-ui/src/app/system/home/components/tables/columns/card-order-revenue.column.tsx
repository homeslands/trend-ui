import { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import moment from 'moment'

import { formatCurrency } from '@/utils'
import { CardOrderRevenue } from '@/types/card-order-revenue.type'
import { RevenueTypeQuery } from '@/constants'

interface ICardOrderRevenueColumnProps {
    type?: string;
}

export const CardOrderRevenueColumn = (props: ICardOrderRevenueColumnProps): ColumnDef<CardOrderRevenue>[] => {
    const { t } = useTranslation(['dashboard'])

    return [
        {
            accessorKey: 'date',
            header: () => (
                <div className={`${props.type === RevenueTypeQuery.DAILY ? 'w-28' : 'w-52'} text-center font-bold text-black dark:text-white`}>
                    {t('dashboard.cardOrder.date')}
                </div>
            ),
            cell: ({ row }) => {
                const date = row.original.date
                const dateStr = props.type === RevenueTypeQuery.DAILY ? moment(date).format('DD/MM/YYYY') : moment(date).format('HH:mm:ss DD/MM/YYYY')
                return (
                    <div className="text-sm text-center">
                        {dateStr || ''}
                    </div>
                )
            },
        },
        {
            accessorKey: 'totalRevenue',
            header: () => (
                <div className='w-28 font-bold text-black dark:text-white text-center'>
                    {t('dashboard.cardOrder.totalRevenue')}
                </div>
            ),
            cell: ({ row }) => {
                const totalRevenue = Number(row.original.totalRevenue || 0)
                return < div className="text-sm text-end" > {formatCurrency(totalRevenue)}</div >
            },
        },
        {
            accessorKey: 'totalCardOrdersByBank',
            header: () => (
                <div className='w-40 font-bold text-black dark:text-white text-center'>
                    {t('dashboard.cardOrder.totalCardOrdersByBank')}
                </div>
            ),
            cell: ({ row }) => {
                const totalCardOrdersByBank = row.original.totalCardOrdersByBank
                return <div className="text-sm text-center">{totalCardOrdersByBank}</div>
            },
        },
        {
            accessorKey: 'bankRevenue',
            header: () => (
                <div className='w-40 font-bold text-black dark:text-white text-center'>
                    {t('dashboard.cardOrder.bankRevenue')}
                </div>
            ),
            cell: ({ row }) => {
                const originalAmount = Number(row.original.bankRevenue)
                return <div className="text-sm text-end">{formatCurrency(originalAmount)}</div>
            },
        },
        {
            accessorKey: 'totalCardOrdersByCash',
            header: () => (
                <div className='w-40 font-bold text-black dark:text-white text-center'>
                    {t('dashboard.cardOrder.totalCardOrdersByCash')}
                </div>
            ),
            cell: ({ row }) => {
                const totalCardOrdersByCash = row.original.totalCardOrdersByCash
                return <div className="text-sm text-center">{totalCardOrdersByCash}</div>
            },
        },
        {
            accessorKey: 'cashRevenue',
            header: () => (
                <div className='w-36 font-bold text-black dark:text-white text-center'>
                    {t('dashboard.cardOrder.cashRevenue')}
                </div>
            ),
            cell: ({ row }) => {
                const promotionAmount = Number(row.original.cashRevenue)
                return <div className="text-sm text-end">{formatCurrency(promotionAmount)}</div>
            },
        },
        {
            accessorKey: 'cardCount',
            header: () => (
                <div className='w-40 font-bold text-black dark:text-white text-center'>
                    {t('dashboard.cardOrder.cardCount')}
                </div>
            ),
            cell: ({ row }) => {
                const voucherAmount = row.original.cardCount
                return <div className="text-sm text-center">{formatCurrency(voucherAmount, "")}</div>
            },
        },
        {
            accessorKey: 'totalCardOrders',
            header: () => (
                <div className='w-40 font-bold text-black dark:text-white text-center'>
                    {t('dashboard.cardOrder.totalCardOrders')}
                </div>
            ),
            cell: ({ row }) => {
                const pointAmount = row.original.totalCardOrders
                return <div className="text-sm text-center">{formatCurrency(pointAmount, "")}</div>
            },
        },
        {
            accessorKey: 'selfTopupOrderCount',
            header: () => (
                <div className='w-40 font-bold text-black dark:text-white text-center'>
                    {t('dashboard.cardOrder.selfTopupOrderCount')}
                </div>
            ),
            cell: ({ row }) => {
                const totalAmount = row.original.selfTopupOrderCount
                return <div className="text-sm text-center">{formatCurrency(totalAmount, "")}</div>
            },
        },
        {
            accessorKey: 'giftTopupOrderCount',
            header: () => (
                <div className='w-40 font-bold text-black dark:text-white text-center'>
                    {t('dashboard.cardOrder.giftTopupOrderCount')}
                </div>
            ),
            cell: ({ row }) => {
                const totalAmount = row.original.giftTopupOrderCount
                return <div className="text-sm text-center">{formatCurrency(totalAmount, "")}</div>
            },
        },
        {
            accessorKey: 'cardPurchaseOrderCount',
            header: () => (
                <div className='w-40 font-bold text-black dark:text-white text-center'>
                    {t('dashboard.cardOrder.cardPurchaseOrderCount')}
                </div>
            ),
            cell: ({ row }) => {
                const totalAmount = row.original.cardPurchaseOrderCount
                return <div className="text-sm text-center">{formatCurrency(totalAmount, "")}</div>
            },
        },
    ]
}
