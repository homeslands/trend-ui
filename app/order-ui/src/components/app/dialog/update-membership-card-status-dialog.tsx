import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
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
import { useToggleMembershipCard } from '@/hooks'
import { IUserInfo } from '@/types'

interface IUpdateMembershipCardStatusDialogProps {
    user: IUserInfo
}

export default function UpdateMembershipCardStatusDialog({ user }: IUpdateMembershipCardStatusDialogProps) {
    const queryClient = useQueryClient()
    const { t } = useTranslation(['customer'])
    const { t: tCommon } = useTranslation('common')
    const { t: tToast } = useTranslation('toast')
    const [isOpen, setIsOpen] = useState(false)
    const { mutate: toggleMembershipCard, isPending } = useToggleMembershipCard()

    const isActive = user?.membershipCard?.isActive

    const handleDelete = () => {
        if (!user?.slug) {
            showToast(tToast('toast.membershipCardNotFound', { ns: 'toast' }))
            return
        }

        toggleMembershipCard(user?.slug, {
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: ['users'],
                    exact: false,
                })
                queryClient.refetchQueries({
                    queryKey: ['users'],
                    exact: false,
                })
                showToast(tToast('toast.updateMembershipCardStatusSuccess', { ns: 'toast' }))
                setIsOpen(false)
            },
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger className="flex justify-start w-full" asChild>
                <Button
                    variant="ghost"
                    className="gap-1 px-2 text-sm"
                    onClick={(e) => {
                        e.stopPropagation()
                        setIsOpen(true)
                    }}
                >
                    <ShieldCheck className="w-4 h-4" />
                    {t('customer.updateMembershipCardStatus')}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[18rem] overflow-hidden rounded-lg transition-all duration-300 hover:overflow-y-auto sm:max-h-[32rem] sm:max-w-[28rem]">
                <DialogHeader>
                    <DialogTitle>{t('customer.updateMembershipCardStatus')}</DialogTitle>
                    <DialogDescription>
                        {t('customer.updateMembershipCardStatusDescription')}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2 py-4 text-sm text-muted-foreground">
                    <div>
                        <span>
                            {t('customer.updateMembershipCardStatusContent')} <strong>{user?.firstName} {user?.lastName}</strong>{' '}
                            {t('customer.updateMembershipCardStatusContent2')}{' '}
                            <span className={`font-semibold ${isActive ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {isActive ? tCommon('common.inactive') : tCommon('common.active')}
                            </span>
                            ?
                        </span>
                    </div>
                    <span className="text-xs text-destructive">
                        {tCommon('common.deleteNote')}
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
                        {isPending ? tCommon('common.loading') : tCommon('common.confirm')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
