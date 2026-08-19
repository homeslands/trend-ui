import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { SquareMenu } from 'lucide-react'

import { SystemCustomerManagementTabsContent } from '@/components/app/tabscontent'

export default function CustomerPage() {
  const { t } = useTranslation('customer')
  const { t: tHelmet } = useTranslation('helmet')

  return (
    <div className="grid grid-cols-1 gap-2 h-full">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.customer.title')}</title>
        <meta name="description" content={tHelmet('helmet.customer.title')} />
      </Helmet>
      <span className="flex gap-1 items-center text-lg">
        <SquareMenu />
        {t('customer.title')}
      </span>
      <SystemCustomerManagementTabsContent />
    </div>
  )
}
