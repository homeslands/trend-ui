import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { Store } from 'lucide-react'

import { SystemBranchAndSystemManagementTabs } from '@/components/app/tabs'

export function BranchAndSystemManagementPage() {
  const { t } = useTranslation(['branch'])
  const { t: tHelmet } = useTranslation('helmet')

  return (
    <div className="grid grid-cols-1 w-full h-full">
      <Helmet>
        <meta charSet='utf-8' />
        <title>
          {tHelmet('helmet.branch.title')}
        </title>
        <meta name='description' content={tHelmet('helmet.branch.title')} />
      </Helmet>
      <span className="flex gap-1 items-center text-lg">
        <Store />
        {t('branch.manageBranchAndSystem')}
      </span>
      <SystemBranchAndSystemManagementTabs />
    </div>
  )
}

