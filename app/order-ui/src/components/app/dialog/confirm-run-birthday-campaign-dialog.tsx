import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarHeart } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui'
import { useTriggerBirthdayCampaign } from '@/hooks'
import { showToast } from '@/utils'

export default function ConfirmRunBirthdayCampaignDialog() {
  const { t } = useTranslation('customer')
  const { t: tCommon } = useTranslation('common')
  const [isOpen, setIsOpen] = useState(false)
  const { mutate: runCampaign, isPending } = useTriggerBirthdayCampaign()

  const handleConfirm = () => {
    runCampaign(undefined, {
      onSuccess: () => {
        showToast(t('customer.birthday.runSuccess'))
        setIsOpen(false)
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <CalendarHeart className="mr-2 w-4 h-4" />
          {t('customer.birthday.runCampaign')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[22rem] rounded-md px-6 sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle className="pb-4 border-b">
            <div className="flex gap-2 items-center text-primary">
              <CalendarHeart className="w-6 h-6" />
              {t('customer.birthday.confirmRun')}
            </div>
          </DialogTitle>
          <div className="flex flex-col gap-3 py-4 text-sm text-muted-foreground">
            <p>{t('customer.birthday.confirmRunDescription')}</p>
            <ul className="flex flex-col gap-1 pl-5 list-disc">
              <li>{t('customer.birthday.runNote1')}</li>
              <li>{t('customer.birthday.runNote2')}</li>
              <li>{t('customer.birthday.runNote3')}</li>
              <li>{t('customer.birthday.runNote4')}</li>
            </ul>
          </div>
        </DialogHeader>
        <DialogFooter className="flex flex-row gap-2 justify-center">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {tCommon('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {t('customer.birthday.runConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
