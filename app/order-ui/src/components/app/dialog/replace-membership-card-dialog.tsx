import { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Scan, RefreshCw } from 'lucide-react'
import moment from 'moment'

import {
    Button,
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
    Label,
} from '@/components/ui'

import { IReplaceMembershipCardRequest, IUserInfo } from '@/types'
import { useReplaceMembershipCard } from '@/hooks'
import { showToast, listenRFID } from '@/utils'
import { SimpleDatePicker } from '@/components/app/picker'

interface IReplaceMembershipCardDialogProps {
    user: IUserInfo
}

export default function ReplaceMembershipCardDialog({
    user,
}: IReplaceMembershipCardDialogProps) {
    const queryClient = useQueryClient()
    const { t } = useTranslation(['customer'])
    const { t: tCommon } = useTranslation('common')
    const { t: tToast } = useTranslation('toast')
    const [isOpen, setIsOpen] = useState(false)
    const [code, setCode] = useState<string>('')
    const [expiredAt, setExpiredAt] = useState<string>('')
    const { mutate: replaceMembershipCard, isPending } = useReplaceMembershipCard()

    // Setup RFID listener khi dialog mở
    useEffect(() => {
        if (!isOpen) {
            setCode('')
            setExpiredAt('')
            return
        }

        const cleanup = listenRFID((scannedString: string) => {
            setCode(scannedString)
        })

        return () => {
            cleanup()
        }
    }, [isOpen])

    const handleSubmit = () => {
        if (!user?.slug) {
            showToast(tToast('toast.userNotFound', { ns: 'toast' }))
            return
        }

        if (!code.trim()) {
            showToast(tToast('toast.enterMembershipCardCode', { ns: 'toast' }))
            return
        }

        if (!expiredAt) {
            showToast(tToast('toast.enterExpiredAt', { ns: 'toast' }))
            return
        }

        const replaceMembershipCardParams: IReplaceMembershipCardRequest = {
            user: user.slug,
            code: code.trim(),
            expiredAt: expiredAt,
        }

        replaceMembershipCard(replaceMembershipCardParams, {
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: ['users'],
                    exact: false,
                })
                queryClient.refetchQueries({
                    queryKey: ['users'],
                    exact: false,
                })
                showToast(tToast('toast.replaceMembershipCardSuccess', { ns: 'toast' }) || 'Thay thế thẻ thành viên thành công')
                handleOpenChange(false)
            },
        })
    }

    const handleOpenChange = useCallback((open: boolean) => {
        setIsOpen(open)
        if (!open) {
            // Reset form khi đóng dialog
            setCode('')
            setExpiredAt('')
        }
    }, [])

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    className="flex gap-1 justify-start px-2 w-full text-sm"
                    onClick={(e) => {
                        e.stopPropagation()
                        setIsOpen(true)
                    }}>
                    <RefreshCw className="w-4 h-4" />
                    {t('customer.replaceMembershipCard') || 'Thay thế thẻ thành viên'}
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-[28rem] rounded-md px-6 sm:max-w-[32rem]">
                <DialogHeader>
                    <DialogTitle className="pb-4 border-b border-primary text-primary">
                        <div className="flex gap-2 items-center">
                            <RefreshCw className="w-6 h-6" />
                            {t('customer.replaceMembershipCard') || 'Thay thế thẻ thành viên'}
                        </div>
                    </DialogTitle>
                    <DialogDescription className="pt-4">
                        {t('customer.replaceMembershipCardDescription') ||
                            `Thay thế thẻ thành viên cho ${user?.firstName} ${user?.lastName}`}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-4">
                    {/* Mã thẻ mới */}
                    <div className="space-y-2">
                        <Label className="flex gap-2 items-center">
                            <span className="text-destructive">*</span>
                            {t('customer.membershipCardCode') || 'Mã thẻ thành viên mới'}
                            <Scan className="w-4 h-4 text-muted-foreground" />
                        </Label>
                        {code ? (
                            <div className="flex flex-col gap-2 p-3 bg-green-50 rounded-lg border dark:bg-green-950/20">
                                <p className="text-sm text-green-600 dark:text-green-400">
                                    {t('customer.scannedCode') || 'Mã đã quét thành công'}
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/50">
                                <p className="text-sm text-muted-foreground">
                                    {t('customer.scanCardInstruction') || 'Vui lòng quét thẻ RFID'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Ngày hết hạn */}
                    <div className="space-y-2">
                        <Label htmlFor="expiredAt" className="flex gap-2 items-center">
                            <span className="text-destructive">*</span>
                            {t('customer.expiredAt') || 'Ngày hết hạn'}
                        </Label>
                        <SimpleDatePicker
                            value={expiredAt}
                            onChange={setExpiredAt}
                            disableFutureDates={false}
                            allowEmpty={true}
                            minDate={moment().format('YYYY-MM-DD')}
                        />
                    </div>
                </div>

                <DialogFooter className="flex flex-row gap-2 justify-center">
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        className="border border-gray-300 min-w-24"
                        disabled={isPending}
                    >
                        {tCommon('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="min-w-24"
                        disabled={isPending || !code.trim() || !expiredAt}
                    >
                        {isPending
                            ? tCommon('common.loading') || 'Đang xử lý...'
                            : tCommon('common.confirm') || 'Xác nhận'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
