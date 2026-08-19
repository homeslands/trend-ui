import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { Gift } from 'lucide-react'

import { SystemCardTabs } from '@/components/app/tabs/system-card.tabs'

export default function GiftCardPage() {
  const { t } = useTranslation(['giftCard'])
  const { t: tHelmet } = useTranslation('helmet')

  return (
    <div className="grid grid-cols-1 gap-2 h-full">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.giftCard.title')}</title>
        <meta name="description" content={tHelmet('helmet.giftCard.title')} />
      </Helmet>
      <span className="flex items-center justify-between gap-1 pt-1 text-lg">
        <div className="flex items-center gap-2">
          <Gift />
          {t('giftCard.pageTitle')}
        </div>
      </span>
      {/* Content */}
      <SystemCardTabs />
    </div>
  )
}
