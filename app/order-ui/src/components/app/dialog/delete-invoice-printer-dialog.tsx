import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui'
import { useDeletePrinterForInvoiceArea } from '@/hooks'
import { showToast } from '@/utils'

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  invoiceAreaSlug: string
  printerSlug: string
}

export default function DeleteInvoicePrinterDialog({ isOpen, onOpenChange, invoiceAreaSlug, printerSlug }: Props) {
  const { t } = useTranslation(['chefArea', 'common', 'toast'])
  const { mutate, isPending } = useDeletePrinterForInvoiceArea()

  const handleConfirm = () => {
    mutate({ slug: invoiceAreaSlug, printerSlug }, {
      onSuccess: () => {
        showToast(t('toast:toast.deleteInvoicePrinterSuccess'))
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('chefArea:invoiceArea.confirmDeletePrinter')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('chefArea:invoiceArea.confirmDeletePrinterDescription')}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:common.cancel')}</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>{t('common:common.delete')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
