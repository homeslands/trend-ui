import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
} from '@/components/ui'
import { DeleteAccountForm } from '../form'

import { ROUTE } from '@/constants'
import { useDeleteAccount, useSessionCleanup } from '@/hooks'
import { showToast } from '@/utils'
import type { IDeleteAccountRequest } from '@/types'

export default function DeleteAccountDialog() {
  const { t } = useTranslation('profile')
  const [isOpen, setIsOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [isWarningExpanded, setIsWarningExpanded] = useState(true)

  const { mutate: deleteAccount, isPending } = useDeleteAccount()
  const cleanupSession = useSessionCleanup()
  const navigate = useNavigate()

  // Bỏ qua khoảng trắng thừa và không phân biệt hoa thường — khớp với app mobile.
  // Ma sát thật nằm ở bước nhập mật khẩu ngay sau đó.
  const isConfirmValid = confirmText.trim().toUpperCase() === 'DELETE'

  const handleConfirmTextChange = (value: string) => {
    setConfirmText(value)
    if (value.trim().toUpperCase() !== 'DELETE') {
      setIsConfirmed(false)
    }
  }

  const handleProceed = () => {
    setIsConfirmed(true)
    setIsWarningExpanded(false)
  }

  const handleClose = () => {
    setIsOpen(false)
    setConfirmText('')
    setIsConfirmed(false)
    setIsWarningExpanded(true)
  }

  const onSubmit = (values: IDeleteAccountRequest) => {
    deleteAccount(values, {
      onSuccess: async () => {
        // Dọn đúng như đăng xuất: huỷ đăng ký nhận thông báo và xoá mọi store,
        // nếu không thiết bị vẫn nhận push cho tài khoản vừa bị xoá và giỏ hàng
        // của người này còn lại cho người dùng sau trên cùng máy.
        await cleanupSession()
        showToast(t('profile.deleteAccount.successMessage'))
        // replace: tài khoản không còn, không cho bấm Back về lại trang hồ sơ đã chết.
        navigate(ROUTE.LOGIN, { replace: true })
        handleClose()
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleClose()
      else setIsOpen(true)
    }}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          className="gap-1"
        >
          <Trash2 className="h-4 w-4" />
          {t('profile.deleteAccount.title')}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-lg sm:max-w-[28rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('profile.deleteAccount.title')}
          </DialogTitle>
          <DialogDescription>
            {t('profile.deleteAccount.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto py-4">
          {/* Warning section — collapsible on mobile */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 sm:p-4">
            <Button
              type="button"
              variant="ghost"
              className="flex w-full items-center justify-between text-left hover:bg-transparent p-0 h-auto font-normal"
              onClick={() => setIsWarningExpanded((prev) => !prev)}
            >
              <span className="text-sm font-semibold text-destructive">
                {t('profile.deleteAccount.warningTitle')}
              </span>
              {isWarningExpanded ? (
                <ChevronUp className="h-4 w-4 text-destructive sm:hidden" />
              ) : (
                <ChevronDown className="h-4 w-4 text-destructive sm:hidden" />
              )}
            </Button>
            <div className={`mt-1 ${!isWarningExpanded ? 'hidden sm:block' : ''}`}>
              <p className="text-sm text-muted-foreground">
                {t('profile.deleteAccount.warningContent')}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                <li>{t('profile.deleteAccount.warningItems.dataLost')}</li>
                <li>{t('profile.deleteAccount.warningItems.loyaltyLost')}</li>
                <li>{t('profile.deleteAccount.warningItems.giftCardLost')}</li>
                <li>{t('profile.deleteAccount.warningItems.irreversible')}</li>
              </ul>
            </div>
          </div>

          {/* Step 1: Type DELETE confirmation */}
          {!isConfirmed && (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                {t('profile.deleteAccount.typeDelete')}
              </span>
              <Input
                value={confirmText}
                onChange={(e) => handleConfirmTextChange(e.target.value)}
                onFocus={() => {
                  setIsWarningExpanded(false)
                }}
                placeholder="DELETE"
                className="font-mono"
              />
              {confirmText && !isConfirmValid && (
                <span className="text-xs text-destructive">
                  {t('profile.deleteAccount.typeDeleteMismatch')}
                </span>
              )}
            </div>
          )}

          {/* Step 2: Password form — only visible after typing DELETE */}
          {isConfirmed && (
            <DeleteAccountForm
              onSubmit={onSubmit}
              isPending={isPending}
              onCancel={handleClose}
            />
          )}

          {/* Proceed button — visible before confirmation */}
          {!isConfirmed && (
            <DialogFooter className="flex flex-row gap-2 justify-between sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleClose}
              >
                {t('profile.deleteAccount.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={!isConfirmValid}
                onClick={handleProceed}
              >
                {t('profile.deleteAccount.proceed')}
              </Button>
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
