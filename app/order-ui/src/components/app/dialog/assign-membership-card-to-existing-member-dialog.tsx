import { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CreditCard, Scan } from 'lucide-react'
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

import { ICreateMembershipCardRequest, IUserInfo } from '@/types'
import { useCreateMembershipCard, useUsers } from '@/hooks'
import { showToast, listenRFID, showErrorToastMessage } from '@/utils'
import { SimpleDatePicker } from '@/components/app/picker'

interface IAssignMembershipCardToExistingMemberDialogProps {
  user: IUserInfo
}

export default function AssignMembershipCardToExistingMemberDialog({
  user,
}: IAssignMembershipCardToExistingMemberDialogProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation(['customer'])
  const { t: tCommon } = useTranslation('common')
  const { t: tToast } = useTranslation('toast')
  const [isOpen, setIsOpen] = useState(false)
  const [code, setCode] = useState<string>('')
  const [expiredAt, setExpiredAt] = useState<string>('')
  const [currentScanCode, setCurrentScanCode] = useState<string>('') // Mã thẻ đang kiểm tra trong database
  const { mutate: createMemberShipCard, isPending } = useCreateMembershipCard()

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

  // Xử lý kết quả từ useUsers hook (sau khi API trả về)
  // useEffect này được trigger khi:
  // - users data thay đổi (API đã trả về kết quả)
  // - currentScanCode thay đổi
  useEffect(() => {
    if (!currentScanCode || !users || isCheckingCode) {
      return // Chưa có kết quả hoặc đang loading
    }

    const foundUsers = users?.result?.items || []

    // Kiểm tra trong DATABASE - nếu đã có user với membershipCard code này
    if (foundUsers.length > 0) {
      showErrorToastMessage(tToast('toast.membershipCardAlreadyExists', { ns: 'toast' }))
      setCode('') // Clear the code input
      setCurrentScanCode('') // Reset để sẵn sàng kiểm tra mã tiếp theo
      return
    }

    // Nếu chưa có user với code này trong database → code hợp lệ, giữ nguyên trong input
    setCurrentScanCode('') // Reset để sẵn sàng kiểm tra mã tiếp theo
  }, [users, currentScanCode, isCheckingCode, tToast])

  // Setup RFID listener khi dialog mở
  useEffect(() => {
    if (!isOpen) {
      setCode('')
      setExpiredAt('')
      setCurrentScanCode('')
      return
    }

    const cleanup = listenRFID((scannedString: string) => {
      // Kiểm tra nếu đang kiểm tra chính mã này
      if (currentScanCode === scannedString) {
        return // Đang kiểm tra rồi, không cần làm gì
      }

      // Set code vào input
      setCode(scannedString)

      // Set currentScanCode → useUsers hook TỰ ĐỘNG được gọi để kiểm tra trong database
      // Khi currentScanCode thay đổi, useUsers hook sẽ tự động gọi API
      setCurrentScanCode(scannedString)
    })

    return () => {
      cleanup()
    }
  }, [isOpen, currentScanCode])


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

    // Kiểm tra nếu đang kiểm tra code
    if (isCheckingCode) {
      showToast(tToast('toast.checkingCode', { ns: 'toast' }) || 'Đang kiểm tra mã thẻ...')
      return
    }

    // Kiểm tra lại một lần nữa trước khi submit
    if (users?.result?.items && users.result.items.length > 0) {
      showErrorToastMessage(tToast('toast.membershipCardAlreadyExists', { ns: 'toast' }))
      return
    }

    const createMembershipCardParams: ICreateMembershipCardRequest = {
      user: user.slug,
      code: code.trim(),
      expiredAt: expiredAt,
    }

    createMemberShipCard(createMembershipCardParams, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['users'],
          exact: false,
        })
        queryClient.refetchQueries({
          queryKey: ['users'],
          exact: false,
        })
        showToast(tToast('toast.createMembershipCardSuccess', { ns: 'toast' }))
        handleOpenChange(false)
      },
      onError: (error: unknown) => {
        const errorMessage =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          tToast('toast.createMembershipCardError', { ns: 'toast' })
        showErrorToastMessage(errorMessage)
      },
    })
  }

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open)
    if (!open) {
      // Reset form khi đóng dialog
      setCode('')
      setExpiredAt('')
      setCurrentScanCode('')
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
          <CreditCard className="w-4 h-4" />
          {t('customer.createMembershipCard')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[28rem] rounded-md px-6 sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle className="pb-4 border-b border-primary text-primary">
            <div className="flex gap-2 items-center">
              <CreditCard className="w-6 h-6" />
              {t('customer.createMembershipCard')}
            </div>
          </DialogTitle>
          <DialogDescription className="pt-4">
            {t('customer.createMembershipCardDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* Mã thẻ */}
          <div className="space-y-2">
            <Label className="flex gap-2 items-center">
              <span className="text-destructive">*</span>
              {t('customer.membershipCardCode')}
              <Scan className="w-4 h-4 text-muted-foreground" />
            </Label>
            {isCheckingCode && currentScanCode ? (
              <div className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/50">
                <p className="text-sm text-primary">
                  {t('customer.userGroup.checkingCode') || 'Đang kiểm tra mã thẻ...'}
                </p>
              </div>
            ) : code ? (
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
            disabled={isPending || !code.trim() || !expiredAt || isCheckingCode}
          >
            {isPending
              ? tCommon('common.loading')
              : tCommon('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
