import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, QrCode, TriangleAlert, UserPlus } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { isRfidListenerAttached, listenRFID } from '@/utils'
import VoucherFixProductList from './voucher-fix-product-list'
import { useCustomerScanRequestStore } from '@/stores'
import type { ScanRejection } from './voucher-qr-scanner-dialog'

interface VoucherHardwareScannerDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Cùng hợp đồng với bản quét bằng camera để nút quét hoán đổi được hai dialog:
   * trả đúng `false` nghĩa là lần quét đó hỏng và màn chờ nhận lượt quét tiếp
   * theo. Ở đây không có chốt theo khung hình như camera, nhưng vẫn cần chặn
   * lượt quét mới khi lượt trước còn đang tra cứu.
   */
  onScanned: (
    raw: string,
  ) =>
    | ScanRejection
    | boolean
    | void
    | Promise<ScanRejection | boolean | void>
}

/**
 * Màn chờ quét bằng đầu đọc cầm tay (súng quét QR / đầu đọc thẻ).
 *
 * Thiết bị loại này giả lập bàn phím: quét xong nó "gõ" rất nhanh chuỗi ký tự
 * rồi kết bằng Tab/Enter, và `listenRFID` (bọc onscan.js) nhận ra cụm gõ nhanh
 * đó. Không dùng camera, nên không cần quyền camera, không cần HTTPS.
 *
 * Component này KHÔNG biết voucher là gì — nó chỉ trả chuỗi thô cho nơi gọi,
 * giống hệt bản quét bằng camera.
 */
export default function VoucherHardwareScannerDialog({
  isOpen,
  onOpenChange,
  onScanned,
}: VoucherHardwareScannerDialogProps) {
  const { t } = useTranslation(['voucher'])
  const requestOpenCustomerScan = useCustomerScanRequestStore(
    (state) => state.requestOpen,
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasListenerError, setHasListenerError] = useState(false)
  // Lời khuyên cho lượt quét vừa bị từ chối — cùng bộ chữ với màn camera.
  // Giữ câu ĐÃ DỊCH, không phải khoá dịch — tên cũ nói ngược.
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null)
  // Dòng hai: gọi gì thì được. Tách khỏi dòng lý do vì hai câu có vai trò
  // khác nhau — một cái nói cái sai, một cái nói việc cần làm.
  const [noticeHint, setNoticeHint] = useState<string | null>(null)
  const [noticeItems, setNoticeItems] = useState<string[] | null>(null)
  // Hành động nối tiếp cho lượt quét vừa bị từ chối, ví dụ thêm khách hàng.
  const [action, setAction] = useState<ScanRejection['action']>(undefined)

  // Chặn lượt quét mới khi lượt trước còn đang tra cứu. Đầu đọc bắn một sự kiện
  // mỗi lần quét (không lặp theo khung hình như camera), nhưng nhân viên hoàn
  // toàn có thể bóp cò hai lần liên tiếp trước khi có kết quả.
  const isBusyRef = useRef(false)

  // `onScanned` đi qua ref chứ không nằm trong deps: nơi gọi thường tạo hàm mới
  // mỗi lần render, để trong deps thì listener bị gỡ ra gắn lại liên tục và có
  // thể bỏ lỡ đúng lúc người dùng bóp cò.
  const onScannedRef = useRef(onScanned)
  useEffect(() => {
    onScannedRef.current = onScanned
  }, [onScanned])

  useEffect(() => {
    if (!isOpen) return

    isBusyRef.current = false
    setIsProcessing(false)
    setHasListenerError(false)
    setNoticeMessage(null)
    setNoticeHint(null)
    setNoticeItems(null)
    setAction(undefined)

    const stopListening = listenRFID((scanned: string) => {
      if (isBusyRef.current) return
      isBusyRef.current = true
      setIsProcessing(true)

      Promise.resolve(onScannedRef.current(scanned))
        .then((outcome) => {
          // Từ chối thì mở lại để nhân viên bắn phiếu tiếp, và hiện đúng lời
          // khuyên như bên màn camera — cùng một tính năng thì không nên hai
          // người dùng nhận hai mức thông tin khác nhau.
          if (outcome === false) {
            isBusyRef.current = false
            setNoticeMessage(t('voucher.scanHintTryAnother'))
            setNoticeHint(null)
            setNoticeItems(null)
            setAction(undefined)
          } else if (outcome && typeof outcome === 'object') {
            isBusyRef.current = false
            setNoticeMessage(outcome.message)
            setNoticeHint(outcome.hint ?? null)
            setNoticeItems(outcome.hintItems ?? null)
            setAction(outcome.action)
          }
        })
        .catch(() => {
          isBusyRef.current = false
        })
        .finally(() => setIsProcessing(false))
    })

    // onscan.js chỉ cho một listener trên mỗi element, và `listenRFID` nuốt lỗi
    // rồi vẫn trả về hàm cleanup. Không kiểm ở đây thì khi có dialog quét khác
    // đang mở, màn này sẽ chờ vĩnh viễn mà không báo gì.
    if (!isRfidListenerAttached()) {
      setHasListenerError(true)
    }

    return () => {
      stopListening()
    }
  }, [isOpen])

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex gap-2 items-center">
            <QrCode className="w-5 h-5" />
            {t('voucher.scanQrCodeTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('voucher.hardwareScannerInstruction')}
          </DialogDescription>
        </DialogHeader>

        {hasListenerError ? (
          <div className="flex flex-col justify-center items-center py-8 text-center">
            <div className="p-4 mb-4 rounded-full bg-destructive/10">
              <TriangleAlert className="w-12 h-12 text-destructive" />
            </div>
            <p className="mb-2 text-muted-foreground">
              {t('voucher.scannerBusy')}
            </p>
          </div>
        ) : isProcessing ? (
          <div className="flex flex-col justify-center items-center py-8 text-center">
            <div className="p-4 mb-4 rounded-full bg-primary/10">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
            <p className="mb-2 text-muted-foreground">
              {t('voucher.scanQrCodeProcessing')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col justify-center items-center py-8 text-center">
            <div className="p-4 mb-4 rounded-full bg-primary/10">
              <QrCode className="w-12 h-12 text-primary" />
            </div>
            <p className="mb-2 text-muted-foreground">
              {t('voucher.waitingHardwareScan')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('voucher.hardwareScannerHint')}
            </p>
            {noticeMessage && (
              <div className="p-3 mt-4 w-full text-left rounded-lg border border-destructive/30 bg-destructive/5">
                <p className="text-sm font-medium text-destructive">
                  {noticeMessage}
                </p>
                <VoucherFixProductList
                  // Đổi lượt quét là thu gọn lại: danh sách của phiếu trước
                  // không còn liên quan gì tới phiếu vừa quét.
                  key={noticeHint}
                  hint={noticeHint ?? undefined}
                  items={noticeItems ?? undefined}
                />
              </div>
            )}
            {/* Biến ngõ cụt thành bước tiếp theo: mở thẳng màn định danh khách
                hàng, xong quay lại quét voucher mà không mất mạch. */}
            {action === 'add-customer' && (
              <Button
                className="mt-3"
                onClick={() => {
                  onOpenChange(false)
                  requestOpenCustomerScan()
                }}
              >
                <UserPlus className="mr-2 w-4 h-4" />
                {t('voucher.addCustomerToUseVoucher')}
              </Button>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleClose}>
            {t('voucher.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
