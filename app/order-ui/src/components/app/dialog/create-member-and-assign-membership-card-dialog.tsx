import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Scan, CreditCard, X } from 'lucide-react'
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
    Badge,
    ScrollArea,
} from '@/components/ui'
import { useCreateMultipleMembershipCard, useUsers } from '@/hooks'
import { listenRFID, showToast, showErrorToastMessage } from '@/utils'
import { SimpleDatePicker } from '@/components/app/picker'

interface ScannedCode {
    code: string
}

export default function CreateMemberAndAssignMembershipCardDialog() {
    const queryClient = useQueryClient()
    const { t } = useTranslation('customer')
    const { t: tCommon } = useTranslation('common')
    const { t: tToast } = useTranslation('toast')

    const [isOpen, setIsOpen] = useState(false)
    const [scannedCodes, setScannedCodes] = useState<ScannedCode[]>([]) // Danh sách mã thẻ đã scan và thêm vào dialog (local list)
    const [expiredAt, setExpiredAt] = useState<string>('')
    const [currentScanCode, setCurrentScanCode] = useState<string>('') // Mã thẻ đang kiểm tra trong database
    const { mutateAsync: createMultipleMembershipCardAsync, isPending } = useCreateMultipleMembershipCard()

    // Hook useUsers TỰ ĐỘNG được gọi khi currentScanCode thay đổi
    // Khi setCurrentScanCode(scannedCode) được gọi → currentScanCode thay đổi
    // → useUsers hook tự động gọi API để tìm user có membershipCard = currentScanCode
    const { data: users, isLoading: isCheckingCode } = useUsers(
        currentScanCode
            ? {
                page: 1,
                size: 10,
                order: 'DESC',
                hasPaging: false,
                membershipCard: currentScanCode, // Tìm user có membershipCard code này trong database
            }
            : null,
        !!isOpen && !!currentScanCode // Chỉ gọi API khi dialog mở và có currentScanCode
    )

    // BƯỚC 3: Xử lý kết quả từ useUsers hook (sau khi API trả về)
    // useEffect này được trigger khi:
    // - users data thay đổi (API đã trả về kết quả)
    // - currentScanCode thay đổi
    useEffect(() => {
        if (!currentScanCode || !users || isCheckingCode) {
            return // Chưa có kết quả hoặc đang loading
        }

        const foundUsers = users?.result?.items || []

        // BƯỚC 3a: Kiểm tra trong DATABASE - nếu đã có user với membershipCard code này
        if (foundUsers.length > 0) {
            showErrorToastMessage(
                tToast('toast.membershipCardAlreadyExists', { ns: 'toast' })
            )
            setCurrentScanCode('') // Reset để sẵn sàng scan mã tiếp theo
            return
        }

        // BƯỚC 3b: Nếu chưa có user với code này trong database → thêm vào danh sách LOCAL (scannedCodes)
        if (!scannedCodes.some((item) => item.code === currentScanCode)) {
            setScannedCodes((prev) => [...prev, { code: currentScanCode }])
            showToast(tToast('toast.addMembershipCardSuccess', { ns: 'toast' }))
        }

        setCurrentScanCode('') // Reset để sẵn sàng scan mã tiếp theo
    }, [users, currentScanCode, scannedCodes, isCheckingCode, tToast])

    // Setup RFID listener khi dialog mở
    useEffect(() => {
        if (!isOpen) return
        const cleanup = listenRFID((scannedCode: string) => {
            // BƯỚC 1: Kiểm tra trong danh sách LOCAL (scannedCodes) - danh sách mã đã scan trong dialog này
            // Nếu mã đã có trong scannedCodes → báo lỗi và dừng
            if (scannedCodes.some((item) => item.code === scannedCode)) {
                showErrorToastMessage(tToast('toast.membershipCardAlreadyExists', { ns: 'toast' }))
                return
            }

            // Kiểm tra nếu đang kiểm tra chính mã này
            if (currentScanCode === scannedCode) {
                return // Đang kiểm tra rồi, không cần làm gì
            }

            // BƯỚC 2: Set currentScanCode → useUsers hook TỰ ĐỘNG được gọi để kiểm tra trong database
            // Khi currentScanCode thay đổi, useUsers hook (dòng 42) sẽ tự động gọi API
            setCurrentScanCode(scannedCode)
        })

        return () => {
            cleanup()
        }
    }, [isOpen, scannedCodes, currentScanCode, tToast])

    const handleRemoveCode = (codeToRemove: string) => {
        setScannedCodes((prev) => prev.filter((item) => item.code !== codeToRemove))
    }

    const handleSubmit = async () => {
        if (scannedCodes.length === 0) {
            return
        }

        if (!expiredAt) {
            return
        }

        // Tạo user và membership card cho từng mã thẻ tuần tự
        // Backend sẽ tự động tạo user từ RFID code và expiredAt
        const results = []
        for (const scannedCode of scannedCodes) {
            // Giả sử backend API có thể nhận code và expiredAt, tự tạo user
            // Nếu API yêu cầu user slug, có thể cần gọi API tạo user trước
            // Tạm thời sử dụng code làm user identifier (backend sẽ xử lý)
            // const params: ICreateMembershipCardRequest = {
            //     user: scannedCode.code, // Backend sẽ tìm hoặc tạo user từ code này
            //     code: scannedCode.code,
            //     expiredAt: expiredAt,
            // }
            await createMultipleMembershipCardAsync({
                userGroup: null,
                codes: [scannedCode.code],
                expiredAt: expiredAt,
            })
            results.push({ success: true, code: scannedCode.code })
        }

        // const successCount = results.filter((r) => r.success).length
        // const failCount = results.filter((r) => !r.success).length

        queryClient.invalidateQueries({
            queryKey: ['users'],
            exact: false,
        })
        queryClient.refetchQueries({
            queryKey: ['users'],
            exact: false,
        })

        showToast(
            tToast('toast.createMembershipCardSuccess', { ns: 'toast' })
        )
        handleDialogOpenChange(false)
    }

    const handleDialogOpenChange = (open: boolean) => {
        setIsOpen(open)
        if (!open) {
            // Reset states khi đóng dialog
            setScannedCodes([])
            setExpiredAt('')
            setCurrentScanCode('')
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-1 w-full" onClick={() => setIsOpen(true)}>
                    <Scan className="w-4 h-4" />
                    {t('customer.createMembershipCard')}
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-[90%] rounded-md p-0 sm:max-w-[50%] flex flex-col max-h-[90vh]">
                <DialogHeader className="p-4 shrink-0">
                    <DialogTitle className="flex gap-2 items-center text-primary">
                        <CreditCard className="w-5 h-5" />
                        {t('customer.createMembershipCard')}
                    </DialogTitle>
                    <DialogDescription className="mt-2">
                        {isCheckingCode && currentScanCode ? (
                            <span className="text-primary">
                                {t('customer.checkingCode')}
                            </span>
                        ) : scannedCodes.length === 0 ? (
                            <span>{t('customer.scanCardInstruction')}</span>
                        ) : (
                            <span>
                                {t('customer.userGroup.scannedCodesCount')} {scannedCodes.length}{' '}
                                {t('customer.userGroup.code')}
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                {/* Date Picker */}
                <div className="px-4 pb-4 border-b shrink-0">
                    <div className="space-y-2">
                        <Label htmlFor="expiredAt" className="flex gap-2 items-center">
                            <span className="text-destructive">*</span>
                            {t('customer.expiredAt')}
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

                {/* ScrollArea wrapper */}
                <div className="overflow-hidden flex-1 px-4">
                    <ScrollArea className="h-full">
                        <div className="grid grid-cols-1 gap-2 py-4">
                            {isCheckingCode && currentScanCode ? (
                                <div className="flex flex-col justify-center items-center h-32 text-center">
                                    <p className="text-muted-foreground">
                                        {t('customer.userGroup.checkingCode')}
                                    </p>
                                </div>
                            ) : scannedCodes.length > 0 ? (
                                <div className="space-y-3">
                                    {scannedCodes.map((scannedCode) => (
                                        <div
                                            key={scannedCode.code}
                                            className="flex justify-between items-center p-3 rounded-lg border bg-card"
                                        >
                                            <div className="flex-1">
                                                <div className="flex gap-2 items-center">
                                                    <Badge variant="outline" className="font-mono text-sm">
                                                        ••••••••
                                                    </Badge>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="w-8 h-8 text-destructive hover:text-destructive"
                                                onClick={() => handleRemoveCode(scannedCode.code)}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col justify-center items-center h-64 text-center">
                                    <Scan className="mb-4 w-16 h-16 text-muted-foreground" />
                                    <p className="text-muted-foreground">
                                        {t('customer.userGroup.waitingForScan')}
                                    </p>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        {t('customer.userGroup.scanCardInstruction')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Footer */}
                <DialogFooter className="p-4 border-t shrink-0">
                    <div className="flex gap-2 justify-end w-full">
                        <Button
                            variant="outline"
                            onClick={() => handleDialogOpenChange(false)}
                            disabled={isPending}
                        >
                            {tCommon('common.cancel')}
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isPending || scannedCodes.length === 0 || !expiredAt}
                            className="min-w-24"
                        >
                            {isPending
                                ? tCommon('common.loading')
                                : t('customer.createUserAndCard')}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
