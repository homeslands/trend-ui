import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Button,
    DialogFooter,
} from '@/components/ui'

import { showToast } from '@/utils'
import { useDeleteMembershipCard } from '@/hooks'
import { IUserInfo } from '@/types'

interface IDeleteMembershipCardDialogProps {
    user: IUserInfo
}

export default function DeleteMembershipCardDialog({ user }: IDeleteMembershipCardDialogProps) {
    const queryClient = useQueryClient()
    const { t } = useTranslation(['customer'])
    const { t: tCommon } = useTranslation('common')
    const { t: tToast } = useTranslation('toast')
    const [isOpen, setIsOpen] = useState(false)
    const { mutate: deleteMembershipCard, isPending } = useDeleteMembershipCard()

    const handleDelete = () => {
        if (!user?.slug) {
            showToast(tToast('toast.membershipCardNotFound', { ns: 'toast' }))
            return
        }

        deleteMembershipCard(user?.slug, {
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: ['users'],
                    exact: false,
                })
                queryClient.refetchQueries({
                    queryKey: ['users'],
                    exact: false,
                })
                showToast(tToast('toast.deleteMembershipCardSuccess', { ns: 'toast' }))
                setIsOpen(false)
            },
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger className="flex justify-start w-full" asChild>
                <Button
                    variant="ghost"
                    className="gap-1 px-2 text-sm bg-destructive/15 text-destructive hover:bg-destructive/30 hover:text-destructive"
                    onClick={(e) => {
                        e.stopPropagation()
                        setIsOpen(true)
                    }}
                >
                    <Trash2 className="w-4 h-4" />
                    {t('customer.deleteMembershipCard')}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[18rem] overflow-hidden rounded-lg transition-all duration-300 hover:overflow-y-auto sm:max-h-[32rem] sm:max-w-[28rem]">
                <DialogHeader>
                    <DialogTitle>{t('customer.deleteMembershipCard')}</DialogTitle>
                    <DialogDescription>
                        {t('customer.deleteMembershipCardDescription')}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2 py-4 text-sm text-muted-foreground">
                    <div>
                        <span>
                            {t('customer.deleteMembershipCardContent')} <strong>{user?.firstName} {user?.lastName}</strong>
                        </span>
                    </div>
                    <span>
                        {t('customer.deleteMembershipCardContent2')}
                    </span>
                </div>
                <DialogFooter className="flex flex-row gap-2 justify-between sm:justify-end">
                    <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => setIsOpen(false)}
                        disabled={isPending}
                    >
                        {tCommon('common.cancel')}
                    </Button>
                    <Button
                        variant="destructive"
                        className="w-full sm:w-auto"
                        onClick={handleDelete}
                        disabled={isPending}
                    >
                        {isPending ? tCommon('common.loading') : tCommon('common.delete')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
