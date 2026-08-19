import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui'
import { useDeleteInvoiceArea } from '@/hooks'
import { showToast } from '@/utils'

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  slug: string
}

export default function DeleteInvoiceAreaDialog({ isOpen, onOpenChange, slug }: Props) {
  const { t } = useTranslation(['chefArea', 'common', 'toast'])
  const { mutate, isPending } = useDeleteInvoiceArea()

  const handleConfirm = () => {
    mutate(slug, {
      onSuccess: () => {
        showToast(t('toast:toast.deleteInvoiceAreaSuccess'))
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('chefArea:invoiceArea.confirmDelete')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('chefArea:invoiceArea.confirmDeleteDescription')}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:common.cancel')}</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>{t('common:common.delete')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
