import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleSlash } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui'
import { ICampaign } from '@/types'
import { CAMPAIGN_STATUS } from '@/constants'
import { useUpdateCampaign } from '@/hooks'
import { showToast } from '@/utils'

export default function ConfirmCloseCampaignDialog({ campaign }: { campaign: ICampaign }) {
  const { t } = useTranslation('campaign')
  const [isOpen, setIsOpen] = useState(false)
  const { mutate: updateCampaign, isPending } = useUpdateCampaign()

  const handleConfirm = () => {
    updateCampaign(
      { slug: campaign.slug, status: CAMPAIGN_STATUS.CLOSED },
      {
        onSuccess: () => {
          showToast(t('campaign.closeSuccess'))
          setIsOpen(false)
        },
      },
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="gap-1 justify-start px-2 w-full text-sm">
          <CircleSlash className="w-4 h-4" />
          {t('campaign.closeCampaign')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[22rem] rounded-md px-6 sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle className="pb-4 border-b">
            <div className="flex gap-2 items-center text-primary">
              <CircleSlash className="w-6 h-6" />
              {t('campaign.confirmClose')}
            </div>
          </DialogTitle>
          <div className="flex flex-col gap-3 py-4 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{campaign.name}</span> —{' '}
              {t('campaign.confirmCloseDescription')}
            </p>
            <ul className="flex flex-col gap-1 pl-5 list-disc">
              <li>{t('campaign.closeNote1')}</li>
              <li>{t('campaign.closeNote2')}</li>
            </ul>
          </div>
        </DialogHeader>
        <DialogFooter className="flex flex-row gap-2 justify-center">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t('campaign.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {t('campaign.closeCampaign')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
