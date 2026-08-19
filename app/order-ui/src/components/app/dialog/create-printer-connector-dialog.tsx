import { useTranslation } from 'react-i18next'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { ICreatePrinterConnectorRequest } from '@/types'
import { useCreatePrinterConnector } from '@/hooks'
import { showToast } from '@/utils'

interface CreatePrinterConnectorDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onCloseSheet: () => void
  data: ICreatePrinterConnectorRequest | null
  onSuccess?: () => void
}

export default function CreatePrinterConnectorDialog({
  isOpen,
  onOpenChange,
  onCloseSheet,
  data,
  onSuccess,
}: CreatePrinterConnectorDialogProps) {
  const { t } = useTranslation(['chefArea', 'common', 'toast'])
  const { mutate: createConnector, isPending } = useCreatePrinterConnector()

  const handleConfirm = () => {
    if (!data) return
    createConnector(data, {
      onSuccess: () => {
        showToast(t('toast:toast.createPrinterConnectorSuccess'))
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
          <DialogTitle>{t('chefArea:printerConnector.confirmCreate')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('chefArea:printerConnector.confirmCreateDescription')}
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
