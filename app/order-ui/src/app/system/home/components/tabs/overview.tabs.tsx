import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import OrderOverViewTabContent from "./order-overview.tab-content"
import CardOrderOverViewTabContent from "./card-order-overview.tab-content"

enum OverviewTabEnum {
    DEFAULT = 'order',
    CARD_ORDER = 'card-order'
}

export default function OverviewTabs() {
    const { t } = useTranslation(['dashboard'])
    const [searchParams, setSearchParams] = useSearchParams()
    const [tab, setTab] = useState(searchParams.get('panel') || OverviewTabEnum.DEFAULT)

    useEffect(() => {
        setSearchParams(prev => {
            prev.set('panel', tab)
            return prev
        })
    }, [tab, setSearchParams])

    return (
        <Tabs defaultValue={tab} className="w-full">
            <TabsList className="flex gap-3 justify-start mb-6 border-b sm:grid-cols-6 lg:mb-0">
                <TabsTrigger
                    value={OverviewTabEnum.DEFAULT}
                    className="flex justify-center min-w-[150px]"
                    onClick={() => setTab(OverviewTabEnum.DEFAULT)}
                >
                    {t('dashboard.order.title')}
                </TabsTrigger>
                <TabsTrigger
                    value={OverviewTabEnum.CARD_ORDER}
                    className="flex justify-center min-w-[160px] w-fit"
                    onClick={() => setTab(OverviewTabEnum.CARD_ORDER)}
                >
                    {t('dashboard.cardOrder.title')}
                </TabsTrigger>
            </TabsList>
            <TabsContent value={OverviewTabEnum.DEFAULT} className="p-0 w-full">
                <OrderOverViewTabContent />
            </TabsContent>
            <TabsContent value={OverviewTabEnum.CARD_ORDER} className="p-0 w-full">
                <CardOrderOverViewTabContent />
            </TabsContent>
        </Tabs >
    )
}