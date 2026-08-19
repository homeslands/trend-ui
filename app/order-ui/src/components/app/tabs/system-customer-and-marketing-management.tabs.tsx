import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import {
  SystemCustomerManagementTabsContent,
  SystemCustomerGroupManagementTabsContent,
  SystemVoucherManagementTabsContent,
  SystemPromotionManagementTabsContent,
  SystemCampaignManagementTabsContent,
} from '@/components/app/tabscontent'
import { useHasPermission } from '@/hooks'
import { Permission } from '@/constants/sidebar-permission'

export function SystemCustomerAndMarketingManagementTabs() {
  const { t } = useTranslation(['customer'])
  const { t: tVoucher } = useTranslation(['voucher'])
  const { t: tPromotion } = useTranslation(['promotion'])
  const { t: tCampaign } = useTranslation(['campaign'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'customer')

  // Check permissions cho từng tab
  const hasCustomerPermission = useHasPermission(Permission.CUSTOMER_MANAGEMENT)
  const hasUserGroupPermission = useHasPermission(Permission.USER_GROUP_MANAGEMENT)
  const hasVoucherPermission = useHasPermission(Permission.VOUCHER_MANAGEMENT)
  const hasPromotionPermission = useHasPermission(Permission.PROMOTION_MANAGEMENT)
  const hasCampaignPermission = hasVoucherPermission

  // Lấy tab đầu tiên có permission làm default nếu tab hiện tại không có permission
  const defaultTab = useMemo(() => {
    if (hasCustomerPermission) return 'customer'
    if (hasUserGroupPermission) return 'customer-group'
    if (hasVoucherPermission) return 'voucher'
    if (hasPromotionPermission) return 'promotion'
    if (hasCampaignPermission) return 'campaign'
    return 'customer' // fallback
  }, [hasCustomerPermission, hasUserGroupPermission, hasVoucherPermission, hasPromotionPermission, hasCampaignPermission])

  // Đảm bảo tab hiện tại có permission, nếu không thì chuyển về default
  useEffect(() => {
    const currentTabHasPermission =
      (tab === 'customer' && hasCustomerPermission) ||
      (tab === 'customer-group' && hasUserGroupPermission) ||
      (tab === 'voucher' && hasVoucherPermission) ||
      (tab === 'promotion' && hasPromotionPermission) ||
      (tab === 'campaign' && hasCampaignPermission)

    if (!currentTabHasPermission && defaultTab) {
      setTab(defaultTab)
    }
  }, [tab, defaultTab, hasCustomerPermission, hasUserGroupPermission, hasVoucherPermission, hasPromotionPermission, hasCampaignPermission])

  useEffect(() => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev)
      newParams.set('tab', tab)
      return newParams
    })
  }, [setSearchParams, tab])

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="scrollbar-hide sticky top-11 z-10 mb-6 flex w-full flex-nowrap justify-start gap-3 overflow-x-auto border-b bg-background sm:grid-cols-6 lg:mb-0">
        {hasCustomerPermission && (
          <TabsTrigger
            value="customer"
            className="flex justify-center min-w-[150px]"
          >
            {t('customer.customer')}
          </TabsTrigger>
        )}
        {hasUserGroupPermission && (
          <TabsTrigger
            value="customer-group"
            className="flex justify-center min-w-[160px] w-fit"
          >
            {t('customer.userGroup.title')}
          </TabsTrigger>
        )}
        {hasVoucherPermission && (
          <TabsTrigger
            value="voucher"
            className="flex justify-center min-w-[150px]"
          >
            {tVoucher('voucher.voucherTitle')}
          </TabsTrigger>
        )}
        {hasPromotionPermission && (
          <TabsTrigger
            value="promotion"
            className="flex justify-center min-w-[150px]"
          >
            {tPromotion('promotion.promotionTitle')}
          </TabsTrigger>
        )}
        {hasCampaignPermission && (
          <TabsTrigger
            value="campaign"
            className="flex justify-center min-w-[150px]"
          >
            {tCampaign('campaign.title')}
          </TabsTrigger>
        )}
      </TabsList>
      {hasCustomerPermission && (
        <TabsContent value="customer" className="p-0 w-full">
          <SystemCustomerManagementTabsContent />
        </TabsContent>
      )}
      {hasUserGroupPermission && (
        <TabsContent value="customer-group" className="p-0 w-full">
          <SystemCustomerGroupManagementTabsContent />
        </TabsContent>
      )}
      {hasVoucherPermission && (
        <TabsContent value="voucher" className="p-0 w-full">
          <SystemVoucherManagementTabsContent />
        </TabsContent>
      )}
      {hasPromotionPermission && (
        <TabsContent value="promotion" className="p-0 w-full">
          <SystemPromotionManagementTabsContent />
        </TabsContent>
      )}
      {hasCampaignPermission && (
        <TabsContent value="campaign" className="p-0 w-full">
          <SystemCampaignManagementTabsContent />
        </TabsContent>
      )}
    </Tabs>
  )
}

