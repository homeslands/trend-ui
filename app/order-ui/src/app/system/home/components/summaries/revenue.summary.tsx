/* eslint-disable @typescript-eslint/no-explicit-any */
import { useTranslation } from 'react-i18next';
import { CreditCardIcon, SigmaIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { formatCurrency } from '@/utils';
import { useMemo } from 'react';
import { RevenueTypeQuery } from '@/constants';
import { useCardOrderRevenue } from '@/hooks/use-card-order-revenue';


function SummaryItem({ item }: { item: { label: string; value: any, icon?: any, unit?: string; } }) {
    const { t } = useTranslation(['dashboard'])

    const SummaryIcon = item.icon;
    return (
        <Card className="shadow-sm hover:bg-primary transition-all hover:text-white hover:shadow-md">
            <CardHeader className="flex flex-row justify-between items-center p-3 pb-2 space-y-0">
                <CardTitle className="text-sm font-normal">
                    {t(item.label)}
                </CardTitle>
                {SummaryIcon && <SummaryIcon className="w-4 h-4" />}
            </CardHeader>
            <CardContent className='p-3'>
                <div className="text-xl font-bold">{`${item.value} ${t(item?.unit || '')}`}</div>
            </CardContent>
        </Card>
    )
}

function SkeletonSummaryItem() {
    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row justify-between items-center p-3 pb-2 space-y-0">
                <CardTitle className="text-sm font-normal">
                    <Skeleton className="mb-4 w-24 h-6" />
                </CardTitle>
                <Skeleton className="mb-4 w-10 h-6" />
            </CardHeader>
            <CardContent className='p-3'>
                <Skeleton className="mb-4 w-52 h-6" />
            </CardContent>
        </Card>
    )
}

export default function RevenueSummary() {
    const { t } = useTranslation(['dashboard'])

    const { data } = useCardOrderRevenue({
        type: RevenueTypeQuery.DAILY
    })

    const summaries = useMemo(() => {
        const totalRevenue = data?.result?.reduce((sum, item) => sum + Number(item.totalRevenue), 0) || 0;
        const bankRevenue = data?.result?.reduce((sum, item) => sum + Number(item.bankRevenue), 0) || 0;
        const cashRevenue = data?.result?.reduce((sum, item) => sum + Number(item.cashRevenue), 0) || 0;
        return [
            { label: 'dashboard.cardOrder.estimatedRevenue', value: formatCurrency(totalRevenue), icon: SigmaIcon },
            { label: 'dashboard.cardOrder.estimatedBankRevenue', value: formatCurrency(bankRevenue), icon: CreditCardIcon },
            { label: 'dashboard.cardOrder.estimatedCashRevenue', value: formatCurrency(cashRevenue), icon: CreditCardIcon },
        ]
    }, [data])

    if (data?.result?.length === 0) {
        return (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {[...Array(1).keys()].map((item) => {
                    return <SkeletonSummaryItem key={item} />
                })}
            </div>
        )
    }

    return (
        <Card className="my-4">
            <CardContent>
                <label htmlFor="" className='font-semibold block mt-4'>{t('dashboard.cardOrder.revenueOverview')}</label>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 mt-4">
                    {summaries.map((item, index) => {
                        return <SummaryItem key={index} item={item} />;
                    })}
                </div>
            </CardContent>
        </Card>


    );
}
