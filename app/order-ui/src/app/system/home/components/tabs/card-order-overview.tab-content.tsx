/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useMemo, useState } from 'react'
import { RefreshCcw, SquareMenu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import moment from 'moment'

import { Badge, Button, ExcelIcon } from '@/components/ui'
import CardOrderRevenueSummary from '../summaries/card-order-revenue.summary'
import { useCardOrderRevenue, useExportCardOrderRevenue, useExportPdfCardOrderRevenue } from '@/hooks/use-card-order-revenue'
import CardOrderRevenueChart from '../charts/card-order-revenue.chart'
import CardOrderRevenueTable from '../tables/card-order-revenue.table'
import { PdfIcon } from '@/components/ui/icons/pdf'
import { saveAs } from 'file-saver'
import { RevenueFilterPopover } from '@/components/app/popover'
import { IRevenueQuery } from '@/types'
import { RevenueTypeQuery } from '@/constants'
import PointTransactionSummary from '../summaries/point-transaction.summary'
import RevenueSummary from '../summaries/revenue.summary'

const defaultFilter = {
    fromDate: moment().startOf('month').format('YYYY-MM-DD'),
    toDate: moment().endOf('month').format('YYYY-MM-DD'),
    type: RevenueTypeQuery.DAILY
}

export default function CardOrderOverViewTabContent() {
    const { t } = useTranslation(['dashboard'])
    const { t: tCommon } = useTranslation(['common'])
    const [filter, setFilter] = useState<any>(defaultFilter);

    const { data, refetch } = useCardOrderRevenue({
        fromDate: moment(filter.fromDate).format('YYYY-MM-DD'),
        toDate: moment(filter.toDate).format('YYYY-MM-DD'),
        type: filter.type
    })
    const { mutate: exportMutation } = useExportCardOrderRevenue();
    const { mutate: exportPdfMutation } = useExportPdfCardOrderRevenue();

    const minOrderSequence = useMemo(() => {
        const min = data?.result?.reduce((min, cur) => Number(cur.minOrderSequence) < min ? Number(cur.minOrderSequence) : min, Infinity);
        return min === Infinity ? undefined : min;
    }, [data?.result])

    const maxOrderSequence = useMemo(() => {
        const max = data?.result?.reduce((max, cur) => Number(cur.maxOrderSequence) > max ? Number(cur.maxOrderSequence) : max, 0);
        if (!max) return undefined;
        return max > 0 ? max : undefined;
    }, [data?.result])

    // const handleOnDateRangeChange = useCallback((dateRange: { startDate: string; endDate: string }) => {
    //     setFilter((prev: any) => {
    //         return {
    //             ...prev,
    //             fromDate: dateRange.startDate,
    //             toDate: dateRange.endDate
    //         }
    //     })
    // },[filter.fromDate, filter.toDate])

    const handleSelectDateRange = useCallback((dateRange: IRevenueQuery) => {
        const newStartDate = dateRange.startDate
            ? moment(dateRange.startDate).format('YYYY-MM-DD HH:mm:ss')
            : '';

        const newEndDate = dateRange.endDate
            ? moment(dateRange.endDate).format('YYYY-MM-DD HH:mm:ss')
            : '';

        setFilter((prev: any) => {
            return {
                ...prev,
                fromDate: newStartDate,
                toDate: newEndDate,
                type: dateRange.type
            }
        })
    }, [filter.fromDate, filter.toDate, filter.type]);

    const onExportExcel = () => {
        const params = {
            ...filter,
        }
        exportMutation(params, {
            onSuccess: (data) => {
                saveAs(data.blob, data.filename);
            },
        })
    }

    const onExportPdf = () => {
        const params = {
            ...filter,
        }
        exportPdfMutation(params, {
            onSuccess: (data) => {
                saveAs(data.blob, data.filename);
            },
        })
    }

    const renderDateFilterValue = (date: string) => {
        switch (filter.type) {
            case RevenueTypeQuery.DAILY:
                return moment(date).format('DD/MM/YYYY')
            case RevenueTypeQuery.HOURLY:
                return moment(date).format('HH:mm:ss DD/MM/YYYY')
        }
    }

    return (
        <div className="mb-10">
            <div className='flex gap-1 items-center'>
                <SquareMenu />
                {t('dashboard.cardOrder.title')}
            </div>
            <div className='mt-2'>
                <PointTransactionSummary />
            </div>

            <div className='mt-4'>
                <RevenueSummary />
            </div>

            <div className='flex gap-2 justify-end items-center mt-4 flex-wrap mx-2'>
                <div className="flex-shrink-0">
                    <RevenueFilterPopover onApply={handleSelectDateRange} initialValue={{ startDate: filter.fromDate, endDate: filter.toDate, type: filter.type }} />
                    {/* <DateRangePicker startDate={filter.fromDate} endDate={filter.toDate} onDateRangeChange={handleOnDateRangeChange} /> */}
                </div>
                <Button variant="outline" className='bg-background' onClick={onExportExcel}>
                    <ExcelIcon />
                    Excel
                </Button>
                <Button variant="outline" className='bg-background' onClick={onExportPdf}>
                    <PdfIcon />
                    PDF
                </Button>
                <Button
                    variant="outline"
                    className="flex flex-shrink-0 gap-1 items-center"
                    onClick={() => refetch()}
                >
                    <RefreshCcw />
                    {tCommon('common.refresh')}
                </Button>
            </div>
            {filter.fromDate && filter.toDate && (
                <div className='flex gap-2 items-center mt-4 flex-wrap'>
                    <span className='text-sm text-muted-foreground'>{t('dashboard.filter')}</span>
                    <Badge className='flex gap-1 items-center h-8 text-sm' variant='outline'>
                        {`${renderDateFilterValue(filter.fromDate)} - ${renderDateFilterValue(filter.toDate)}`}
                    </Badge>
                    <Badge className='flex gap-1 items-center h-8 text-sm' variant='outline'>
                        {filter.type === RevenueTypeQuery.HOURLY ? t('dashboard.hourly') : t('dashboard.daily')}
                    </Badge>
                    <Badge className='flex gap-1 items-center h-8 text-sm' variant='outline'>
                        {t('dashboard.cardOrder.orderSequence')}: {minOrderSequence || ''} - {maxOrderSequence || ''}
                    </Badge>
                </div>
            )}
            <div className='mt-4'>
                <CardOrderRevenueSummary data={data?.result || []} />
            </div>
            <div className="mt-4">
                <CardOrderRevenueChart data={data?.result || []} />
            </div>
            <div className="mt-4">
                <CardOrderRevenueTable data={data?.result || []} type={filter.type} />
            </div>
        </div >
    )
}