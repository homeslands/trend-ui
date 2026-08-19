import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { useSearchParams } from 'react-router-dom'
import { SystemCardTabContent } from '../tabscontent/system-card.tabscontent'
import { SystemCoinPolicyTabContent } from '../tabscontent/system-coin-policy.tabscontent'
import { SystemFeatureFlagTabContent } from '../tabscontent/system-feature-flag.tabscontent'

export enum SystemCardTabEnum {
  FEATURE_FLAGS = 'feature-flags',
  COIN_POLICY = 'coin-policy',
  CARD = 'card'
}

export function SystemCardTabs() {
  const { t } = useTranslation(['giftCard'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('panel') || SystemCardTabEnum.CARD)

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
          value={SystemCardTabEnum.CARD}
          className="flex justify-center min-w-[150px]"
          onClick={() => setTab(SystemCardTabEnum.CARD)}
        >
          {t('giftCard.card.title')}
        </TabsTrigger>
        <TabsTrigger
          value={SystemCardTabEnum.COIN_POLICY}
          className="flex justify-center min-w-[160px] w-fit"
          onClick={() => setTab(SystemCardTabEnum.COIN_POLICY)}
        >
          {t('giftCard.card.coinPolicyTitle')}
        </TabsTrigger>
        <TabsTrigger
          value={SystemCardTabEnum.FEATURE_FLAGS}
          className="flex justify-center min-w-[160px] w-fit"
          onClick={() => setTab(SystemCardTabEnum.FEATURE_FLAGS)}
        >
          {t('giftCard.card.featureFlagTitle')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value={SystemCardTabEnum.CARD} className="p-0 w-full">
        <SystemCardTabContent />
      </TabsContent>
      <TabsContent value={SystemCardTabEnum.COIN_POLICY} className="p-0 w-full">
        <SystemCoinPolicyTabContent />
      </TabsContent>
      <TabsContent value={SystemCardTabEnum.FEATURE_FLAGS} className="p-0 w-full">
        <SystemFeatureFlagTabContent />
      </TabsContent>
    </Tabs >
  )
}
