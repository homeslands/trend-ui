import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import {
  SystemBranchManagementTabsContent,
  SystemChefAreaManagementTabsContent,
  SystemBankConfigManagementTabsContent,
} from '@/components/app/tabscontent'

export function SystemBranchAndSystemManagementTabs() {
  const { t } = useTranslation(['branch'])
  const { t: tChefArea } = useTranslation(['chefArea'])
  const { t: tBank } = useTranslation(['bank'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'branch')

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
          value="branch"
          className="flex justify-center min-w-[150px]"
          onClick={() => setTab('branch')}
        >
          {t('branch.manageBranch')}
        </TabsTrigger>
        <TabsTrigger
          value="chef-area"
          className="flex justify-center min-w-[160px] w-fit"
          onClick={() => setTab('chef-area')}
        >
          {tChefArea('chefArea.title')}
        </TabsTrigger>
        <TabsTrigger
          value="bank"
          className="flex justify-center min-w-[150px]"
          onClick={() => setTab('bank')}
        >
          {tBank('bank.title')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="branch" className="p-0 w-full">
        <SystemBranchManagementTabsContent />
      </TabsContent>
      <TabsContent value="chef-area" className="p-0 w-full">
        <SystemChefAreaManagementTabsContent />
      </TabsContent>
      <TabsContent value="bank" className="p-0 w-full">
        <SystemBankConfigManagementTabsContent />
      </TabsContent>
    </Tabs>
  )
}

