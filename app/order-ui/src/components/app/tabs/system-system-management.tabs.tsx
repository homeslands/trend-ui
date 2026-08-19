import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import {
  SystemRoleManagementTabsContent,
  SystemConfigManagementTabsContent,
  SystemBannerManagementTabsContent,
  SystemLogManagementTabsContent,
  SystemStaticPageManagementTabsContent,
  SystemLockManagementTabsContent,
  SystemPrinterConnectorManagementTabsContent,
} from '@/components/app/tabscontent'

export function SystemSystemManagementTabs() {
  const { t } = useTranslation(['role'])
  const { t: tSystem } = useTranslation(['system'])
  const { t: tConfig } = useTranslation(['config'])
  const { t: tBanner } = useTranslation(['banner'])
  const { t: tLog } = useTranslation(['log'])
  const { t: tStaticPage } = useTranslation(['staticPage'])
  const { t: tChefArea } = useTranslation(['chefArea'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'role')

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
          value="role"
          className="flex justify-center min-w-[120px]"
          onClick={() => setTab('role')}
        >
          {t('role.title')}
        </TabsTrigger>
        <TabsTrigger
          value="config"
          className="flex justify-center min-w-[120px]"
          onClick={() => setTab('config')}
        >
          {tConfig('config.title')}
        </TabsTrigger>
        <TabsTrigger
          value="banner"
          className="flex justify-center min-w-[120px]"
          onClick={() => setTab('banner')}
        >
          {tBanner('banner.bannerTitle')}
        </TabsTrigger>
        <TabsTrigger
          value="log"
          className="flex justify-center min-w-[120px]"
          onClick={() => setTab('log')}
        >
          {tLog('log.title')}
        </TabsTrigger>
        <TabsTrigger
          value="static-page"
          className="flex justify-center min-w-[120px]"
          onClick={() => setTab('static-page')}
        >
          {tStaticPage('staticPage.staticPageTitle')}
        </TabsTrigger>
        <TabsTrigger
          value="lock"
          className="flex justify-center min-w-[120px]"
          onClick={() => setTab('lock')}
        >
          {tSystem('system.lockFeature.title')}
        </TabsTrigger>
        <TabsTrigger
          value="printer-connector"
          className="flex justify-center min-w-[120px]"
          onClick={() => setTab('printer-connector')}
        >
          {tChefArea('printerConnector.title')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="role" className="p-0 w-full">
        <SystemRoleManagementTabsContent />
      </TabsContent>
      <TabsContent value="config" className="p-0 w-full">
        <SystemConfigManagementTabsContent />
      </TabsContent>
      <TabsContent value="banner" className="p-0 w-full">
        <SystemBannerManagementTabsContent />
      </TabsContent>
      <TabsContent value="log" className="p-0 w-full">
        <SystemLogManagementTabsContent />
      </TabsContent>
      <TabsContent value="static-page" className="p-0 w-full">
        <SystemStaticPageManagementTabsContent />
      </TabsContent>
      <TabsContent value="lock" className="p-0 w-full">
        <SystemLockManagementTabsContent />
      </TabsContent>
      <TabsContent value="printer-connector" className="p-0 w-full">
        <SystemPrinterConnectorManagementTabsContent />
      </TabsContent>
    </Tabs>
  )
}

