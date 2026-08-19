import { useMemo } from 'react'
import { SquareMenu } from 'lucide-react'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import moment from 'moment'

import { DataTable } from '@/components/ui'
import { useBanners } from '@/hooks'
import { useBannerColumns } from './DataTable/columns'
import { BannerActionOptions } from './DataTable/actions'


export default function BannerPage() {
    const { t } = useTranslation(['banner'])
    const { t: tHelmet } = useTranslation('helmet')
    const { data, isLoading } = useBanners()

    // Sort dữ liệu banner theo createdAt từ mới nhất -> cũ nhất
    const sortedBanners = useMemo(() => {
        if (!data?.result || data.result.length === 0) return []
        
        return [...data.result].sort((a, b) => {
            const dateA = moment(a.createdAt).valueOf()
            const dateB = moment(b.createdAt).valueOf()
            return dateB - dateA // Mới nhất -> cũ nhất (DESC)
        })
    }, [data?.result])

    return (
        <div className="flex flex-col flex-1 w-full">
            <Helmet>
                <meta charSet='utf-8' />
                <title>
                    {tHelmet('helmet.banner.title')}
                </title>
                <meta name='description' content={tHelmet('helmet.banner.title')} />
            </Helmet>
            <span className="flex items-center gap-1 text-lg">
                <SquareMenu />
                {t('banner.bannerTitle')}
            </span>
            <div className="grid h-full grid-cols-1 gap-2">
                <DataTable
                    columns={useBannerColumns()}
                    data={sortedBanners}
                    isLoading={isLoading}
                    pages={1}
                    onPageChange={() => { }}
                    onPageSizeChange={() => { }}
                    actionOptions={BannerActionOptions}
                />
            </div>
        </div>
    )
}
