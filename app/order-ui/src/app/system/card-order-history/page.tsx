import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { Gift } from 'lucide-react'

import { SystemCardOrderHistoryTabs } from '@/components/app/tabs/system-card-order-history.tabs'

export interface IFilterProps {
  startDate?: string;
  endDate?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  status?: any;
}

export default function CardOrderHistoryPage() {
  const { t } = useTranslation(['giftCard'])
  const { t: tHelmet } = useTranslation('helmet')

  return (
    <div className="grid grid-cols-1 w-full h-full">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.cardOrder.title')}</title>
        <meta name="description" content={tHelmet('helmet.cardOrder.title')} />
      </Helmet>
      {/* Tiêu đề dính top-0, TabsList dính top-11 ngay dưới nó — cùng pattern với trang
          quản lý khách hàng. Cả hai PHẢI có `bg-background`, nếu không nội dung cuộn
          bên dưới sẽ lộ xuyên qua. */}
      <div className="sticky top-0 z-20 flex gap-2 items-center py-2 text-lg text-gray-900 bg-background dark:text-white">
        <Gift className="text-gray-700 dark:text-gray-300" />
        {t('giftCard.cardOrder.title')}
      </div>
      {/* Content */}
      <SystemCardOrderHistoryTabs />
    </div>
  )
}
