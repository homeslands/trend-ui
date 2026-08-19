import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import { CatalogTab, SizeTab, ProductTab } from '@/app/system/products'

export function SystemProductManagementTabsContent() {
  const { t } = useTranslation(['product'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedTab, setSelectedTab] = useState(searchParams.get('subTab') || 'product')

  useEffect(() => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev)
      newParams.set('subTab', selectedTab)
      return newParams
    })
  }, [setSearchParams, selectedTab])

  const handleTabChange = (value: string) => {
    setSelectedTab(value)
  }

  const renderContent = () => {
    switch (selectedTab) {
      case 'catalog':
        return <CatalogTab />
      case 'size':
        return <SizeTab />
      case 'product':
        return <ProductTab />
      default:
        return <ProductTab />
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 w-full">
      <div className="flex justify-start">
        <Select value={selectedTab} onValueChange={handleTabChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('tab.product')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="catalog">{t('tab.catalog')}</SelectItem>
            <SelectItem value="size">{t('tab.size')}</SelectItem>
            <SelectItem value="product">{t('tab.product')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {renderContent()}
    </div>
  )
}

