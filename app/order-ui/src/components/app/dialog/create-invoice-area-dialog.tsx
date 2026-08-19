import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui'
import { ICreateInvoiceAreaRequest } from '@/types'
import { useCreateInvoiceArea } from '@/hooks'
import { showToast } from '@/utils'

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onCloseSheet: () => void
  data: ICreateInvoiceAreaRequest | null
  onSuccess?: () => void
}

export default function CreateInvoiceAreaDialog({ isOpen, onOpenChange, onCloseSheet, data, onSuccess }: Props) {
  const { t } = useTranslation(['chefArea', 'common', 'toast'])
  const { mutate, isPending } = useCreateInvoiceArea()

  const handleConfirm = () => {
    if (!data) return
    mutate(data, {
      onSuccess: () => {
        showToast(t('toast:toast.createInvoiceAreaSuccess'))
        onOpenChange(false)
        onCloseSheet()
        onSuccess?.()
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('chefArea:invoiceArea.confirmCreate')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('chefArea:invoiceArea.confirmCreateDescription')}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:common.cancel')}</Button>
          <Button onClick={handleConfirm} disabled={isPending}>{t('common:common.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
