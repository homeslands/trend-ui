import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { SystemMenuAndProductManagementTabsContent } from '@/components/app/tabscontent'

export function SystemMenuAndProductManagementTabs() {
  const { t } = useTranslation(['menu'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'menu')

  useEffect(() => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev)
      newParams.set('tab', tab)
      return newParams
    })
  }, [setSearchParams, tab])

  return (
    <Tabs defaultValue={tab} className="w-full">
      <TabsList className="flex gap-3 justify-start mb-6 border-b sm:grid-cols-6 lg:mb-0">
        <TabsTrigger
          value="menu"
          className="flex justify-center min-w-[150px]"
          onClick={() => setTab('menu')}
        >
          {t('menu.menuManagement')}
        </TabsTrigger>
        <TabsTrigger
          value="product"
          className="flex justify-center min-w-[160px] w-fit"
          onClick={() => setTab('product')}
        >
          {t('menu.productManagement')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="menu" className="p-0 w-full">
        <SystemMenuAndProductManagementTabsContent />
      </TabsContent>
      <TabsContent value="product" className="p-0 w-full">
        <SystemMenuAndProductManagementTabsContent />
      </TabsContent>
    </Tabs>
  )
}
