import { } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { Store } from 'lucide-react'

import { Button, Badge, Skeleton } from '@/components/ui'
import { useBranch, useGetAllBranchConfigs } from '@/hooks'
import { ROUTE } from '@/constants'
import { BranchConfigForm } from './components/branch-config-form'

export default function BranchDetailPage() {
  const { t } = useTranslation(['branch'])
  const { t: tHelmet } = useTranslation('helmet')
  const { t: tCommon } = useTranslation('common')
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { data: branchesData, isLoading: isLoadingBranches } = useBranch()
  const { data: configsData, isLoading: isLoadingConfigs, refetch: refetchConfigs } = useGetAllBranchConfigs(slug || '')
  
  const branch = branchesData?.result?.find((b) => b.slug === slug)
  const configs = configsData?.result || []

  if (isLoadingBranches) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!branch) {
    return (
      <div className="flex flex-col gap-4">
        <p>{tCommon('common.notFound')}</p>
        <Button onClick={() => navigate(ROUTE.STAFF_BRANCH_AND_SYSTEM_MANAGEMENT)}>
          {tCommon('common.back')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.branch.title')} - {branch.name}</title>
        <meta name="description" content={tHelmet('helmet.branch.title')} />
      </Helmet>

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Store className="w-6 h-6" />
          <span>{branch.name}</span>
        </div>
      </div>

      {/* Branch Info */}
      <div className="p-4 border rounded-lg dark:border-gray-700">
        <h3 className="mb-4 text-lg font-semibold">{t('branch.branchInfo')}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <span className="text-sm text-muted-foreground">{t('branch.slug')}</span>
            <Badge className="ml-2">{branch.slug}</Badge>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">{t('branch.branchName')}</span>
            <p className="mt-1">{branch.name}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-sm text-muted-foreground">{t('branch.branchAddress')}</span>
            <p className="mt-1">{branch.address}</p>
          </div>
        </div>
      </div>

      {/* Branch Config */}
      <BranchConfigForm
        branchSlug={slug || ''}
        configs={configs}
        isLoading={isLoadingConfigs}
        onSuccess={refetchConfigs}
      />
    </div>
  )
}

