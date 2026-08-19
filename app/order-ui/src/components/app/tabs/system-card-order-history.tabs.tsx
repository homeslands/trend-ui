import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { SystemCardOrderTabContent } from '../tabscontent/system-card-order-history.tabscontent'
import { SystemTransactionPointHistoryTabContent } from '../tabscontent/system-transaction-point-history.tabscontent'

export enum SystemCardOrderHistoryTabEnum {
  CARD_ORDER_TAB = 'card-order',
  COIN_TAB = 'coin'
}

const TAB_VALUES: string[] = Object.values(SystemCardOrderHistoryTabEnum)

export function SystemCardOrderHistoryTabs() {
  const { t } = useTranslation(['giftCard'])
  const [searchParams, setSearchParams] = useSearchParams()

  // URL là NGUỒN SỰ THẬT DUY NHẤT của tab đang mở — cố tình KHÔNG mirror sang `useState`.
  // Giữ state cục bộ rồi ghi ngược ra URL (kể cả khi Tabs đã `value`-controlled) vẫn
  // hỏng Back/Forward: URL đổi nhưng state thì không, nên tab hiển thị đứng yên. Đọc
  // thẳng từ param thì mọi nguồn thay đổi — bấm tab, Back/Forward, gõ tay `?panel=` —
  // đều chảy qua cùng một đường.
  const panel = searchParams.get('panel')
  const tab =
    panel && TAB_VALUES.includes(panel)
      ? panel
      : SystemCardOrderHistoryTabEnum.CARD_ORDER_TAB

  const handleTabChange = useCallback(
    (value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('panel', value)
        // `page`/`size` do `usePagination` ghi ra URL và dùng CHUNG cho cả hai tab — xoá
        // khi đổi tab để không mang số trang của tab cũ sang tab mới (đang ở trang 5 của
        // tab này, sang tab kia có thể rơi vào trang trống).
        next.delete('page')
        next.delete('size')
        return next
      })
    },
    [setSearchParams],
  )

  return (
    <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="scrollbar-hide sticky top-11 z-10 mb-6 flex w-full flex-nowrap justify-start gap-3 overflow-x-auto border-b bg-background sm:grid-cols-6 lg:mb-0">
        <TabsTrigger
          value={SystemCardOrderHistoryTabEnum.CARD_ORDER_TAB}
          className="flex justify-center min-w-[150px]"
        >
          {t('giftCard.cardOrder.shortTitle')}
        </TabsTrigger>
        <TabsTrigger
          value={SystemCardOrderHistoryTabEnum.COIN_TAB}
          className="flex justify-center min-w-[160px] w-fit"
        >
          {t('giftCard.cardOrder.coinTitle')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value={SystemCardOrderHistoryTabEnum.CARD_ORDER_TAB} className="p-0 w-full">
        <SystemCardOrderTabContent />
      </TabsContent>
      <TabsContent value={SystemCardOrderHistoryTabEnum.COIN_TAB} className="p-0 w-full">
        <SystemTransactionPointHistoryTabContent />
      </TabsContent>
    </Tabs>
  )
}
