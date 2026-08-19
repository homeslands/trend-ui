import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SquarePen } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  ScrollArea,
} from '@/components/ui'

import { UpdateBranchConfigForm } from '@/components/app/form'
import { IBranchConfig } from '@/types'

interface IUpdateBranchConfigDialogProps {
  branchConfig: IBranchConfig
}

export function UpdateBranchConfigDialog({
  branchConfig,
}: IUpdateBranchConfigDialogProps) {
  const { t } = useTranslation(['config'])
  const [isOpen, setIsOpen] = useState(false)

  const handleSubmit = (isOpen: boolean) => {
    setIsOpen(isOpen)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild className="flex justify-start">
        <Button
          variant="outline"
          className="gap-1 h-10 text-sm"
          onClick={() => setIsOpen(true)}
        >
          <SquarePen className="icon" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[20rem] rounded-md px-6 sm:max-w-[44rem]">
        <DialogHeader>
          <DialogTitle>{t('config.update')}</DialogTitle>
          <DialogDescription>
            {t('config.updateBranchConfigDescription')}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[24rem]">
          <UpdateBranchConfigForm
            onSubmit={handleSubmit}
            branchConfig={branchConfig}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

