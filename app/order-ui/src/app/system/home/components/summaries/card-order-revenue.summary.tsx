/* eslint-disable @typescript-eslint/no-explicit-any */
import { useTranslation } from 'react-i18next';
import { CreditCardIcon, SigmaIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { formatCurrency } from '@/utils';
import { CardOrderRevenue } from '@/types/card-order-revenue.type';
import { useMemo } from 'react';
import { CardStackIcon } from '@radix-ui/react-icons';

interface ICardOrderRevenueSummaryProps {
    data: CardOrderRevenue[];
}

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

export default function CardOrderRevenueSummary({ data }: ICardOrderRevenueSummaryProps) {
    const summaries = useMemo(() => {
        const totalCardOrders = data?.reduce((sum, item) => sum + Number(item.totalCardOrders), 0);
        const totalRevenue = data?.reduce((sum, item) => sum + Number(item.totalRevenue), 0);
        const bankRevenue = data?.reduce((sum, item) => sum + Number(item.bankRevenue), 0);
        const cashRevenue = data?.reduce((sum, item) => sum + Number(item.cashRevenue), 0);
        const cardCount = data?.reduce((sum, item) => sum + Number(item.cardCount), 0);
        const selfTopupOrderCount = data?.reduce((sum, item) => sum + Number(item.selfTopupOrderCount), 0);
        const giftTopupOrderCount = data?.reduce((sum, item) => sum + Number(item.giftTopupOrderCount), 0);
        const cardPurchaseOrderCount = data?.reduce((sum, item) => sum + Number(item.cardPurchaseOrderCount), 0);
        return [
            { label: 'dashboard.cardOrder.totalRevenue', value: formatCurrency(totalRevenue), icon: SigmaIcon },
            { label: 'dashboard.cardOrder.bankRevenue', value: formatCurrency(bankRevenue), icon: CreditCardIcon },
            { label: 'dashboard.cardOrder.cashRevenue', value: formatCurrency(cashRevenue), icon: CreditCardIcon },
            { label: 'dashboard.cardOrder.cardCount', value: cardCount, icon: CardStackIcon, unit: 'dashboard.cardOrder.giftCard' },
            { label: 'dashboard.cardOrder.totalCardOrders', value: totalCardOrders, icon: SigmaIcon, unit: 'dashboard.cardOrder.label' },
            { label: 'dashboard.cardOrder.selfTopupOrderCount', value: selfTopupOrderCount, icon: SigmaIcon, unit: 'dashboard.cardOrder.label' },
            { label: 'dashboard.cardOrder.giftTopupOrderCount', value: giftTopupOrderCount, icon: SigmaIcon, unit: 'dashboard.cardOrder.label' },
            { label: 'dashboard.cardOrder.cardPurchaseOrderCount', value: cardPurchaseOrderCount, icon: SigmaIcon, unit: 'dashboard.cardOrder.label' },
        ]
    }, [data])

    if (!data) {
        return (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {[...Array(8).keys()].map((item) => {
                    return <SkeletonSummaryItem key={item} />
                })}
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {summaries.map((item, index) => {
                return <SummaryItem key={index} item={item} />;
            })}
        </div>
    );
}
