/* eslint-disable @typescript-eslint/no-explicit-any */
import { useTranslation } from 'react-i18next';
import { ArrowDownIcon, ArrowUpIcon, CoinsIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react';

import { Button, Card, CardContent, ExcelIcon } from "@/components/ui";
import { formatCurrency } from '@/utils';
import { useAnalyzePointTransactions, useExportSystemPointTransactions, useIsMobile } from '@/hooks';
import { saveAs } from 'file-saver'

export default function PointTransactionSummary() {
    const { t: tDashboard } = useTranslation(['dashboard'])

    const { t } = useTranslation(['profile'])
    const isMobile = useIsMobile()

    const payload = {
        type: null,
    }

    const { data: analyzeData, isLoading: isLoadingAnalysis } = useAnalyzePointTransactions(payload);
    const { mutate: exportMutation } = useExportSystemPointTransactions();

    const handleExport = () => {
        const ITEM_MAX = 10000000;
        const params = {
            page: 1,
            size: ITEM_MAX,
            type: null,
            ignoreSize: true
        }

        exportMutation(params, {
            onSuccess: (data) => {
                saveAs(data.blob, data.filename);
            },
        })
    }

    if (isLoadingAnalysis) {
        return (
            <div className="mb-6">
                <div
                    className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-4 lg:grid-cols-3'}`}
                >
                    {Array(3)
                        .fill(0)
                        .map((_, index) => (
                            <Card key={index} className="animate-pulse">
                                <CardContent className="p-4">
                                    <div className="mb-2 h-4 bg-gray-200 rounded"></div>
                                    <div className="h-8 bg-gray-200 rounded"></div>
                                </CardContent>
                            </Card>
                        ))}
                </div>
            </div>
        )
    }

    const summaryItems = [
        {
            title: t('profile.totalEarnedCoin'),
            value: analyzeData?.result?.totalEarned || 0,
            icon: TrendingUpIcon,
            color: 'text-green-600',
            bg: 'bg-green-50 dark:bg-green-900/10',
            border: 'border-green-200 dark:border-green-800',
            iconBg:
                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        },
        {
            title: t('profile.totalSpentCoin'),
            value: analyzeData?.result?.totalSpent || 0,
            icon: TrendingDownIcon,
            color: 'text-red-600',
            bg: 'bg-red-50 dark:bg-red-900/10',
            border: 'border-red-200 dark:border-red-800',
            iconBg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        },
        {
            title: t('profile.netDifference'),
            value: analyzeData?.result?.netDifference || 0,
            icon: analyzeData?.result?.netDifference && analyzeData?.result?.netDifference >= 0 ? ArrowUpIcon : ArrowDownIcon,
            color: analyzeData?.result?.netDifference && analyzeData?.result?.netDifference >= 0 ? 'text-green-600' : 'text-red-600',
            bg:
                analyzeData?.result?.netDifference && analyzeData?.result?.netDifference >= 0
                    ? 'bg-green-50 dark:bg-green-900/10'
                    : 'bg-red-50 dark:bg-red-900/10',
            border:
                analyzeData?.result?.netDifference && analyzeData?.result?.netDifference >= 0
                    ? 'border-green-200 dark:border-green-800'
                    : 'border-red-200 dark:border-red-800',
            iconBg:
                analyzeData?.result?.netDifference && analyzeData?.result?.netDifference >= 0
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        },
    ]

    return (
        <Card className="my-4">
            <CardContent>
                <label htmlFor="" className='font-semibold block mt-4'>{tDashboard('dashboard.cardOrder.coinOverview')}</label>
                <div className='flex items-center justify-end flex-wrap gap-2'>
                    <Button variant="outline" className='bg-background' onClick={handleExport}>
                        <ExcelIcon />
                        Excel
                    </Button>
                </div>
                <div
                    className={`grid mt-4 ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-4 lg:grid-cols-3'}`}
                >
                    {summaryItems.map((item, index) => (
                        <Card
                            key={index}
                            className={`border ${item.border} ${item.bg} shadow-sm transition-shadow hover:shadow-md`}
                        >
                            <CardContent className={`${isMobile ? 'p-3' : 'p-4'}`}>
                                <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                        <p
                                            className={`mb-1 text-xs font-medium text-gray-600 dark:text-gray-400 ${isMobile ? 'text-[10px]' : ''}`}
                                        >
                                            {item.title}
                                        </p>
                                        <div
                                            className={`flex items-center gap-1 ${item.color} font-bold ${isMobile ? 'text-lg' : 'text-xl'}`}
                                        >
                                            <span>{formatCurrency(Math.abs(item.value), '')}</span>
                                            <CoinsIcon
                                                className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-primary`}
                                            />
                                        </div>
                                    </div>
                                    <div className={`rounded-full p-2 ${item.iconBg}`}>
                                        <item.icon size={isMobile ? 16 : 20} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
