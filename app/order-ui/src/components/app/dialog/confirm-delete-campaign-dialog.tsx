import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, TriangleAlert } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui'
import { ICampaign } from '@/types'
import { useDeleteCampaign } from '@/hooks'
import { showToast } from '@/utils'

export default function ConfirmDeleteCampaignDialog({ campaign }: { campaign: ICampaign }) {
  const { t } = useTranslation('campaign')
  const { t: tCommon } = useTranslation('common')
  const [isOpen, setIsOpen] = useState(false)
  const { mutate: deleteCampaign, isPending } = useDeleteCampaign()

  const handleConfirm = () => {
    deleteCampaign(campaign.slug, {
      onSuccess: () => {
        showToast(t('campaign.deleteSuccess'))
        setIsOpen(false)
      },
      onError: () => {
        // Lỗi 159909 (chiến dịch đã phát thưởng) đã có toast riêng từ MutationCache,
        // chỉ cần đóng dialog để người dùng đọc được thông báo.
        setIsOpen(false)
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="gap-1 justify-start px-2 w-full text-sm text-destructive hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
          {t('campaign.deleteCampaign')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[22rem] rounded-md sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle className="pb-4 border-b border-destructive text-destructive">
            <div className="flex gap-2 items-center">
              <TriangleAlert className="w-6 h-6" />
              {t('campaign.deleteCampaign')}
            </div>
          </DialogTitle>
          <DialogDescription className="p-2 rounded-md bg-red-100 dark:bg-transparent text-destructive">
            {tCommon('common.deleteNote')}
          </DialogDescription>
          <div className="py-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{campaign.name}</span>
            <br />
            <br />
            {t('campaign.confirmDelete')}
          </div>
        </DialogHeader>
        <DialogFooter className="flex flex-row gap-2 justify-center">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t('campaign.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {tCommon('common.confirmDelete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
