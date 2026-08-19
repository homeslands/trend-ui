import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import moment from 'moment'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { ScrollArea, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { SystemHorizontalCatalogSelect, SystemMapAddressSelect, SystemTableSelect } from '../select'
import { SystemMenuTabscontent } from '../tabscontent'
import { useCatalogStore, useOrderFlowStore, useUserStore } from '@/stores'
import { FilterState, IGroupedMenuItem, OrderTypeEnum } from '@/types'
import { flattenSpecificMenuPages, useCatalogs, useSpecificMenuInfinite } from '@/hooks'
import { MENU_PAGE_SIZE } from '@/constants'

export function SystemMenuTabs() {
  const { t } = useTranslation(['menu'])
  const [searchParams, setSearchParams] = useSearchParams()
  const { userInfo } = useUserStore()
  const { getCartItems, initializeOrdering, setOrderingType } = useOrderFlowStore()
  const cartItems = getCartItems()
  const { catalog } = useCatalogStore()

  const activeTab = searchParams.get('tab') || 'table'

  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const preCartItems = useRef<OrderTypeEnum | null | undefined>(null)
  const [filters, setFilters] = useState<FilterState>({
    date: moment().format('YYYY-MM-DD'),
    branch: userInfo?.branch?.slug,
    catalog: catalog?.slug,
    productName: '',
  })
  const {
    data: specificMenu,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useSpecificMenuInfinite(
    { ...filters, size: MENU_PAGE_SIZE, hasPaging: true },
    !!userInfo?.slug,
  )
  const specificMenuResult = flattenSpecificMenuPages(specificMenu?.pages)

  const { data: catalogsData, isLoading: isLoadingCatalogs } = useCatalogs()

  const sortedCatalogs = useMemo(() => {
    return [...(catalogsData?.result ?? [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [catalogsData?.result])

  const sortedMenuItems = useMemo(() => {
    const items = specificMenuResult?.menuItems ? [...specificMenuResult.menuItems] : []
    return items.sort((a, b) => {
      // Đưa các mục không bị khóa lên trước
      if (a.isLocked !== b.isLocked) {
        return Number(a.isLocked) - Number(b.isLocked)
      }

      // Coi mục với currentStock = null là "còn hàng" khi isLimit = false
      const aInStock = (a.currentStock !== 0 && a.currentStock !== null) || !a.product.isLimit
      const bInStock = (b.currentStock !== 0 && b.currentStock !== null) || !b.product.isLimit

      // Đưa các mục còn hàng lên trước
      if (aInStock !== bInStock) {
        return Number(bInStock) - Number(aInStock) // Còn hàng trước hết hàng
      }
      if (a.product.catalog.name !== b.product.catalog.name) {
        return a.product.catalog.name.localeCompare(b.product.catalog.name)
      }
      return 0
    })
  }, [specificMenuResult?.menuItems])

  // Recomputed whenever more menu items load, so catalog groups update alongside pagination.
  // Groups stay in the same order as `sortedCatalogs` (not re-sorted by item count) so that
  // loading another page doesn't reshuffle already-rendered catalog sections under the user's scroll.
  const groupedMenuItems = useMemo<IGroupedMenuItem[]>(() => {
    return sortedCatalogs.map((catalog) => ({
      catalog,
      items: sortedMenuItems.filter((item) => item.product.catalog.slug === catalog.slug),
    }))
  }, [sortedCatalogs, sortedMenuItems])

  const observerRef = useRef<IntersectionObserver | null>(null)
  const isIntersectingRef = useRef(false)
  const isFetchingNextPageRef = useRef(isFetchingNextPage)
  const hasNextPageRef = useRef(hasNextPage)
  const fetchNextPageRef = useRef(fetchNextPage)

  useEffect(() => {
    isFetchingNextPageRef.current = isFetchingNextPage
    hasNextPageRef.current = hasNextPage
    fetchNextPageRef.current = fetchNextPage
  }, [isFetchingNextPage, hasNextPage, fetchNextPage])

  const tryLoadMore = useCallback(() => {
    if (isIntersectingRef.current && !isFetchingNextPageRef.current && hasNextPageRef.current) {
      fetchNextPageRef.current()
    }
  }, [])

  // Callback ref instead of a plain object ref + effect: the "menu" tab's content unmounts/
  // remounts when switching to another tab and back, which swaps in a brand-new sentinel DOM
  // node. An effect with static deps would keep observing the stale, detached node forever
  // after that remount, so scrolling would stop loading more pages the second time the tab is
  // visited. A callback ref re-runs on every mount/unmount of the node itself, re-attaching a
  // fresh observer each time.
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        isIntersectingRef.current = entries[0].isIntersecting
        tryLoadMore()
      },
      { threshold: 0.5 },
    )
    observer.observe(node)
    observerRef.current = observer
  }, [tryLoadMore])

  // A short page 1 (fewer items than fit on screen) never scrolls, so the sentinel can stay
  // continuously intersecting without the observer firing again. Re-check once fetch state
  // settles (e.g. hasNextPage flips to true) so pages keep loading until the sentinel is
  // actually pushed off-screen or there's nothing left to fetch.
  useEffect(() => {
    tryLoadMore()
  }, [hasNextPage, isFetchingNextPage, tryLoadMore])

  useEffect(() => {
    if (isFirstLoad) {
      setIsFirstLoad(false)
      if (!cartItems?.type) {
        initializeOrdering()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setFilters((prev: FilterState) => ({
      ...prev,
      branch: userInfo?.branch?.slug,
      catalog: catalog?.slug,
      productName: '',
    }))
  }, [userInfo?.branch?.slug, catalog?.slug])

  const handleSelectCatalog = (catalog: string) => {
    setFilters((prev: FilterState) => ({
      ...prev,
      catalog: catalog,
    }))
  }

  // Handle tab change by updating URL
  const handleTabChange = useCallback((tab: string) => {
    setSearchParams({ tab }, { replace: true })
  }, [setSearchParams])

  useEffect(() => {
    if (cartItems?.type === OrderTypeEnum.TAKE_OUT) {
      handleTabChange('menu')
    } else if (cartItems?.type === OrderTypeEnum.AT_TABLE && !isFirstLoad && preCartItems.current) {
      handleTabChange('table')
    } else if (cartItems?.type === OrderTypeEnum.DELIVERY && !isFirstLoad && preCartItems.current) {
      handleTabChange('delivery')
    }
    preCartItems.current = cartItems?.type
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems?.type])

  // Guard: if no owner or owner is default-customer, ensure delivery is not active
  useEffect(() => {
    const noOwner = !cartItems?.ownerFullName || !cartItems?.ownerPhoneNumber
    const isDefault = cartItems?.ownerFullName === 'default-customer'
    if ((noOwner || isDefault) && cartItems?.type === OrderTypeEnum.DELIVERY) {
      setOrderingType(OrderTypeEnum.AT_TABLE)
      handleTabChange('table')
    }
  }, [cartItems?.ownerFullName, cartItems?.ownerPhoneNumber, cartItems?.type, setOrderingType, handleTabChange])

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      {/* TabsList luôn sticky */}
      <div className="flex sticky top-0 z-20 flex-wrap gap-4 items-center py-2 bg-white shadow-sm dark:bg-background">
        <TabsList className="grid grid-cols-2 gap-3 sm:grid-cols-5 xl:grid-cols-6">
          {cartItems?.type === OrderTypeEnum.AT_TABLE && (
            <TabsTrigger value="table" className="flex justify-center">
              {t('menu.table')}
            </TabsTrigger>
          )}
          {cartItems?.type === OrderTypeEnum.DELIVERY && (
            <TabsTrigger value="delivery" className="flex justify-center">
              {t('menu.delivery')}
            </TabsTrigger>
          )}
          <TabsTrigger value="menu" className="flex justify-center">
            {t('menu.menu')}
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Tab Content: Table */}
      {cartItems?.type === OrderTypeEnum.AT_TABLE && (
        <TabsContent value="table" className="p-0 w-full sm:w-[90%] xl:w-full">
          <SystemTableSelect />
        </TabsContent>
      )}

      {/* Tab Content: Delivery */}
      {cartItems?.type === OrderTypeEnum.DELIVERY && (
        <TabsContent value="delivery" className="p-0 w-full sm:w-[90%] xl:w-full">
          <SystemMapAddressSelect />
        </TabsContent>
      )}

      {/* Tab Content: Menu */}
      <TabsContent value="menu" className="p-0 pb-4 mt-0 w-full">
        {/* Sticky CatalogSelect chỉ trong tab này */}
        <div className="overflow-x-auto sticky top-14 z-20 py-2 w-full bg-white dark:bg-background">
          <SystemHorizontalCatalogSelect
            defaultValue={filters.catalog}
            onChange={handleSelectCatalog}
            catalogs={sortedCatalogs}
          />
        </div>

        {/* Scrollable nội dung menu */}
        <ScrollArea className="w-full h-full">
          <SystemMenuTabscontent groupedItems={groupedMenuItems} isLoading={isLoading || isLoadingCatalogs} />

          <div ref={loadMoreRef} className="flex justify-center items-center py-6">
            {isFetchingNextPage && (
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            )}
            {!hasNextPage && !!specificMenuResult?.menuItems?.length && (
              <p className="text-sm text-muted-foreground">{t('menu.noMoreData')}</p>
            )}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  )
}
