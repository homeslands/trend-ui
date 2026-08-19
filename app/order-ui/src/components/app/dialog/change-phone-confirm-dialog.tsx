import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui'

interface IChangePhoneConfirmDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export default function ChangePhoneConfirmDialog({
  isOpen,
  onOpenChange,
  onConfirm,
}: IChangePhoneConfirmDialogProps) {
  const { t } = useTranslation(['auth'])

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex gap-2 items-center">
            <TriangleAlert className="w-5 h-5 text-destructive" />
            {t('register.changePhoneTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('register.changePhoneMessage')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('register.backToOtp')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('register.changePhoneConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
