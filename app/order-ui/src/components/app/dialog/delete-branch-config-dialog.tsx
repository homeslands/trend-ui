import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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

import { IBranchConfig } from '@/types'
import { useDeleteBranchConfig } from '@/hooks'
import { showToast } from '@/utils'

interface IDeleteBranchConfigDialogProps {
  branchConfig: IBranchConfig
  onClose?: () => void
}

export function DeleteBranchConfigDialog({
  branchConfig,
  onClose,
}: IDeleteBranchConfigDialogProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation(['config'])
  const { t: tCommon } = useTranslation('common')
  const { t: tToast } = useTranslation('toast')
  const { mutate: deleteBranchConfig } = useDeleteBranchConfig()
  const [isOpen, setIsOpen] = useState(false)

  const handleSubmit = (slug: string) => {
    deleteBranchConfig(slug, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['branchConfigs'],
        })
        setIsOpen(false)
        onClose?.()
        showToast(tToast('toast.deleteBranchConfigSuccess'))
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild className="flex justify-start">
        <Button
          variant="destructive"
          className="gap-1 h-10 text-sm"
          onClick={() => setIsOpen(true)}
        >
          <Trash2 className="icon" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[22rem] rounded-md sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle className="pb-4 border-b border-destructive text-destructive">
            <div className="flex items-center gap-2">
              <TriangleAlert className="w-6 h-6" />
              {t('config.deleteBranchConfig')}
            </div>
          </DialogTitle>
          <DialogDescription className="rounded-md bg-red-100 dark:bg-transparent p-2 text-destructive">
            {tCommon('common.deleteNote')}
          </DialogDescription>

          <div className="py-4 text-sm text-gray-500">
            {t('config.deleteContent')}{' '}
            <span className="font-bold">{branchConfig?.key}</span>
            {t('config.deleteContent2')}{' '}
            <span className="font-bold">{branchConfig?.key}</span>
            {t('config.deleteContent3')}
          </div>
        </DialogHeader>
        <DialogFooter className="flex flex-row justify-center gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {tCommon('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => branchConfig && handleSubmit(branchConfig.slug)}
          >
            {tCommon('common.confirmDelete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

