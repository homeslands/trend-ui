import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Phone } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui'

import { UpdatePhoneNumberForm } from '@/components/app/form'
import { IUserInfo } from '@/types'
import { UserRequirementKey, UserRequirementScope, UserRequirementStatus } from '@/constants/user.constants'

interface IUpdatePhoneNumberDialogProps {
  user: IUserInfo
}

export default function UpdatePhoneNumberDialog({
  user,
}: IUpdatePhoneNumberDialogProps) {
  const { t } = useTranslation(['customer'])
  const [isOpen, setIsOpen] = useState(false)

  // Check if user has pending phone number requirement with initial scope
  const hasPendingPhoneRequirement = user?.userRequirements?.some(
    (req) =>
      req.key === UserRequirementKey.NEED_UPDATE_PHONE_NUMBER &&
      req.status === UserRequirementStatus.PENDING &&
      req.scope === UserRequirementScope.INITIAL
  )

  // Don't render if requirement doesn't exist or is not pending
  if (!hasPendingPhoneRequirement) {
    return null
  }

  const handleSubmit = (isOpen: boolean) => {
    setIsOpen(isOpen)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="flex gap-1 justify-start px-2 w-full text-sm"
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen(true)
          }}>
          <Phone className="w-4 h-4" />
          {t('customer.updatePhoneNumber')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[28rem] rounded-md px-6 sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle>{t('customer.updatePhoneNumber')}</DialogTitle>
          <DialogDescription>
            {t('customer.updatePhoneNumberDescription')}
          </DialogDescription>
        </DialogHeader>
        <UpdatePhoneNumberForm user={user} onSubmit={handleSubmit} />
      </DialogContent>
    </Dialog>
  )
}

