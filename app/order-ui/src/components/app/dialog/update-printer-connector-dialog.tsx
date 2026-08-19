import { useTranslation } from 'react-i18next'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { IUpdatePrinterConnectorRequest } from '@/types'
import { useUpdatePrinterConnector } from '@/hooks'
import { showToast } from '@/utils'

interface UpdatePrinterConnectorDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onCloseSheet: () => void
  slug: string
  data: IUpdatePrinterConnectorRequest | null
  onSuccess?: () => void
}

export default function UpdatePrinterConnectorDialog({
  isOpen,
  onOpenChange,
  onCloseSheet,
  slug,
  data,
  onSuccess,
}: UpdatePrinterConnectorDialogProps) {
  const { t } = useTranslation(['chefArea', 'common', 'toast'])
  const { mutate: updateConnector, isPending } = useUpdatePrinterConnector()

  const handleConfirm = () => {
    if (!data) return
    updateConnector({ slug, params: data }, {
      onSuccess: () => {
        showToast(t('toast:toast.updatePrinterConnectorSuccess'))
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
          <DialogTitle>{t('chefArea:printerConnector.confirmUpdate')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('chefArea:printerConnector.confirmUpdateDescription')}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {t('common:common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
