import { useTranslation } from 'react-i18next'
import { Megaphone } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { IUpdateCampaignRequest } from '@/types'
import { useUpdateCampaign } from '@/hooks'
import { showToast } from '@/utils'

interface ConfirmUpdateCampaignDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onCloseSheet: () => void
  campaign: IUpdateCampaignRequest | null
  onSuccess?: () => void
}

export default function ConfirmUpdateCampaignDialog({
  isOpen,
  onOpenChange,
  onCloseSheet,
  campaign,
  onSuccess,
}: ConfirmUpdateCampaignDialogProps) {
  const { t } = useTranslation('campaign')
  const { mutate: updateCampaign, isPending } = useUpdateCampaign()

  const handleConfirm = () => {
    if (!campaign) return
    updateCampaign(campaign, {
      onSuccess: () => {
        showToast(t('campaign.updateSuccess'))
        onOpenChange(false)
        onCloseSheet()
        onSuccess?.()
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[22rem] rounded-md px-6 sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle className="pb-4 border-b">
            <div className="flex gap-2 items-center text-primary">
              <Megaphone className="w-6 h-6" />
              {t('campaign.confirmUpdate')}
            </div>
          </DialogTitle>
          <div className="py-4 text-sm text-gray-500">
            {t('campaign.confirmUpdateDescription')}
          </div>
        </DialogHeader>
        <DialogFooter className="flex flex-row gap-2 justify-center">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border border-gray-300 min-w-24"
          >
            {t('campaign.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {t('campaign.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
