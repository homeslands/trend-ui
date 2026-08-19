import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { Bolt } from 'lucide-react'

import { SystemSystemManagementTabs } from '@/components/app/tabs'

export function SystemManagementPage() {
  const { t } = useTranslation(['system'])
  const { t: tHelmet } = useTranslation('helmet')

  return (
    <div className="grid grid-cols-1 w-full h-full">
      <Helmet>
        <meta charSet='utf-8' />
        <title>
          {tHelmet('helmet.system.title')}
        </title>
        <meta name='description' content={tHelmet('helmet.system.title')} />
      </Helmet>
      <span className="flex gap-1 items-center text-lg">
        <Bolt />
        {t('system.title')}
      </span>
      <SystemSystemManagementTabs />
    </div>
  )
}

