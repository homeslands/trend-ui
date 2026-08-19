import moment from 'moment'
import { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  DataTableColumnHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui'
import { IBanner } from '@/types'
import { DeleteBannerDialog, UploadBannerBannerDialog } from '@/components/app/dialog'
import UpdateBannerDialog from '@/components/app/dialog/update-banner-dialog'
import { publicFileURL, BannerPage } from '@/constants'
import { BannerStatusSwitch } from '@/components/app/switch'

export const useBannerColumns = (): ColumnDef<IBanner>[] => {
  const { t } = useTranslation(['banner'])
  const { t: tCommon } = useTranslation(['common'])
  return [
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('banner.status')} />
      ),
      cell: ({ row }) => {
        const banner = row.original
        return <div className='w-full flex justify-center items-center'>
          <BannerStatusSwitch banner={banner} />
        </div>
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('banner.createdAt')} />
      ),
      cell: ({ row }) => {
        const createdAt = row.getValue('createdAt')
        return createdAt !== null && createdAt !== undefined ? moment(createdAt).format('hh:mm DD/MM/YYYY') : tCommon('banner.noData')
      },
    },
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('banner.title')} />
      ),
      cell: ({ row }) => {
        const title = row.getValue('title')
        return title !== null && title !== undefined ? title : tCommon('banner.noData')
      },
    },
    {
      accessorKey: 'page',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('banner.page')} />
      ),
      cell: ({ row }) => {
        const page = row.getValue('page') as string
        if (!page) return tCommon('banner.noData')
        
        // Map giá trị page sang translation key
        const pageTranslationMap: Record<string, string> = {
          [BannerPage.HOME]: t('banner.pages.home'),
          [BannerPage.BOOKING]: t('banner.pages.booking'),
          [BannerPage.ABOUT]: t('banner.pages.about'),
          [BannerPage.MENU]: t('banner.pages.menu'),
        }
        
        return pageTranslationMap[page] || page
      },
    },
    {
      accessorKey: 'isActive',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('banner.isActive')} />
      ),
      cell: ({ row }) => {
        const isActive = row.getValue('isActive')
        return isActive === true ? <span className='italic text-green-500'>{t('banner.active')}</span> : <span className='italic text-destructive'>{t('banner.inactive')}</span>
      },
    },
    {
      accessorKey: 'image',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('banner.image')} />,
      cell: ({ row }) => {
        const image = row.getValue('image') ? `${publicFileURL}/${row.getValue('image')}` : ''
        return (
          <img src={image} alt={row.getValue('image')} className="object-cover rounded-md w-36 h-28" />
        )
      }
    },
    {
      id: 'actions',
      header: tCommon('common.action'),
      cell: ({ row }) => {
        const banner = row.original
        return (
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <span className="sr-only">{tCommon('common.action')}</span>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {tCommon('common.action')}
                </DropdownMenuLabel>
                <UpdateBannerDialog banner={banner} />
                <UploadBannerBannerDialog banner={banner} />
                <DeleteBannerDialog banner={banner} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]
}
