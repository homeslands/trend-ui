import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, TriangleAlert } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui'
import { useDeletePrinterConnector } from '@/hooks'
import { showToast } from '@/utils'

interface DeletePrinterConnectorDialogProps {
  slug: string
}

export default function DeletePrinterConnectorDialog({ slug }: DeletePrinterConnectorDialogProps) {
  const { t } = useTranslation(['chefArea', 'common', 'toast'])
  const { mutate: deleteConnector, isPending } = useDeletePrinterConnector()
  const [isOpen, setIsOpen] = useState(false)

  const handleConfirm = () => {
    deleteConnector(slug, {
      onSuccess: () => {
        showToast(t('toast:toast.deletePrinterConnectorSuccess'))
        setIsOpen(false)
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="gap-1 px-2 text-sm text-destructive bg-destructive/10 justify-start w-full"
        >
          <Trash2 className="icon" />
          {t('common:common.delete')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[22rem] rounded-md sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle className="pb-4 border-b border-destructive text-destructive">
            <div className="flex items-center gap-2">
              <TriangleAlert className="w-6 h-6" />
              {t('chefArea:printerConnector.confirmDelete')}
            </div>
          </DialogTitle>
          <DialogDescription className="rounded-md bg-red-100 dark:bg-transparent p-2 text-destructive">
            {t('common:common.deleteNote')}
          </DialogDescription>
          <div className="py-4 text-sm text-muted-foreground">
            {t('chefArea:printerConnector.confirmDeleteDescription')}
          </div>
        </DialogHeader>
        <DialogFooter className="flex flex-row justify-center gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t('common:common.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {t('common:common.confirmDelete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
