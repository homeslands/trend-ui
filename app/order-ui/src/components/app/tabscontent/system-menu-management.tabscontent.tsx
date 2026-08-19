import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { DataTable, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import { useAllMenus, usePagination } from '@/hooks'
import { useBranchStore } from '@/stores'
import { useMenusColumns } from '@/app/system/menu-management/DataTable/columns'
import { MenusActionOptions } from '@/app/system/menu-management/DataTable/actions'
import { IMenu } from '@/types'
import { ROUTE } from '@/constants'

export function SystemMenuAndProductManagementTabsContent() {
  const navigate = useNavigate()
  const { t } = useTranslation(['menu'])
  const { branch } = useBranchStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [menuTab, setMenuTab] = useState(searchParams.get('menuTab') || 'isTemplate')

  const { pagination, handlePageChange, handlePageSizeChange } = usePagination()

  // Set default menuTab and branch slug in URL
  useEffect(() => {
    const updatedParams = new URLSearchParams(searchParams)
    if (!searchParams.get('menuTab')) {
      updatedParams.set('menuTab', 'isTemplate')
    }
    if (branch?.slug) {
      updatedParams.set('branch', branch.slug)
    }
    setSearchParams(updatedParams)
  }, [branch, setSearchParams, searchParams])

  useEffect(() => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev)
      newParams.set('menuTab', menuTab)
      return newParams
    })
  }, [setSearchParams, menuTab])

  const { data, isLoading } = useAllMenus({
    order: 'DESC',
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
    branch: branch?.slug,
    isTemplate: menuTab === 'isTemplate',
  })

  const handleRowClick = (row: IMenu) => {
    navigate(`${ROUTE.STAFF_MENU_AND_PRODUCT_MANAGEMENT}/${row.slug}`)
  }

  const handleTabChange = (value: string) => {
    setMenuTab(value)
  }

  return (
    <div className="grid grid-cols-1 gap-6 w-full">
      <div className="flex justify-start">
        <Select value={menuTab} onValueChange={handleTabChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('menu.isTemplate')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="isTemplate">{t('menu.isTemplate')}</SelectItem>
            <SelectItem value="notTemplate">{t('menu.noTemplate')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={useMenusColumns()}
        data={data?.result.items || []}
        isLoading={isLoading}
        pages={data?.result?.totalPages || 0}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        actionOptions={MenusActionOptions}
        onRowClick={handleRowClick}
      />
    </div>
  )
}
