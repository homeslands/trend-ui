import { useState } from 'react'
import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import moment from 'moment'
import { useTranslation } from 'react-i18next'
import { Download, TriangleAlert } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui'

import { buildVoucherQrPayload, showErrorToastMessage, showToast } from '@/utils'
import { IVoucher } from '@/types'

interface IConfirmExportVoucherDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  selectedVouchers: IVoucher[]
  disabled?: boolean
  onSuccess: () => void
}

export default function ConfirmExportVoucherDialog({
  isOpen,
  onOpenChange,
  selectedVouchers,
  disabled,
  onSuccess,
}: IConfirmExportVoucherDialogProps) {
  const { t } = useTranslation(['voucher'])
  const { t: tCommon } = useTranslation('common')
  const { t: tToast } = useTranslation('toast')
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await exportVouchersAsPDF(selectedVouchers)
      onOpenChange(false)
      onSuccess()
      showToast(tToast('toast.exportVouchersSuccess'))
    } catch {
      // Sinh QR hoặc dựng PDF ném lỗi: không báo gì thì nút bật lại và người dùng
      // thấy một cú bấm không có tác dụng, không biết là đã hỏng.
      showErrorToastMessage('toast.exportVouchersError')
    } finally {
      setIsExporting(false)
    }
  }

  const exportVouchersAsPDF = async (vouchers: IVoucher[]) => {
    if (!vouchers || vouchers.length === 0) return

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'cm',
      format: [5, 2], // Kích thước nhãn 5cm x 2cm
    })

    const pageWidth = 5
    const pageHeight = 2
    const qrSize = 1.5
    const qrX = 0.25
    const qrY = (pageHeight - qrSize) / 2
    const textX = 2.0 // ngay sau QR
    const rightMargin = 0.15 // chừa mép để mực không tràn ra cạnh bế
    const availableTextWidth = pageWidth - textX - rightMargin

    const codeFontSizeDefault = 7
    const codeFontSizeFloor = 5
    const dateFontSize = 6 // nhỏ hơn dòng code: chuỗi HSD có độ dài cố định, không co giãn được

    const lineSpacing = 0.3
    const codeLineHeight = codeFontSizeDefault * 0.035
    const dateLineHeight = dateFontSize * 0.035
    const totalTextHeight = codeLineHeight + lineSpacing + dateLineHeight
    const textYStart = (pageHeight - totalTextHeight) / 2 + codeLineHeight
    const dateYStart = textYStart + lineSpacing + dateLineHeight

    for (const [index, voucher] of vouchers.entries()) {
      if (index !== 0) pdf.addPage()

      // margin: 1 thay vì mặc định 4 — nhãn 1.5cm không đủ chỗ cho viền rộng.
      const qrDataUrl = await QRCode.toDataURL(buildVoucherQrPayload(voucher), {
        margin: 1,
        width: 256,
      })
      pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

      const codeLine = `Code: ${voucher.code}`
      const dateLine = `HSD: ${moment(voucher.startDate).format('DD/MM/YY')} - ${moment(voucher.endDate).format('DD/MM/YY')}`

      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(0, 0, 0)

      // Mã voucher dài tuỳ ý: co dần cỡ chữ tới khi vừa cột, sàn 5pt.
      // Không rút gọn chuỗi — mã bị cắt trông vẫn hợp lệ nhưng sai, còn nguy hiểm hơn chữ nhỏ.
      let codeFontSize = codeFontSizeDefault
      pdf.setFontSize(codeFontSize)
      while (pdf.getTextWidth(codeLine) > availableTextWidth && codeFontSize > codeFontSizeFloor) {
        codeFontSize -= 1
        pdf.setFontSize(codeFontSize)
      }
      pdf.text(codeLine, textX, textYStart)

      // Căn trái, không còn căn giữa: text giờ chia chỗ với QR.
      pdf.setFontSize(dateFontSize)
      pdf.text(dateLine, textX, dateYStart)
    }

    pdf.save('Voucher-tickets.pdf')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          disabled={disabled}
          variant="outline"
          className="flex items-center w-full text-sm"
          onClick={() => onOpenChange(true)}
        >
          <Download className="w-4 h-4" />
          {t('voucher.exportVouchers')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[22rem] rounded-md px-6 sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle className="pb-4 border-b border-primary text-primary">
            <div className="flex gap-2 items-center">
              <TriangleAlert className="w-6 h-6" />
              {t('voucher.exportVouchers')}
            </div>
          </DialogTitle>
          <DialogDescription className="p-2 rounded-md bg-primary/10 text-primary">
            {tCommon('common.deleteNote')}
          </DialogDescription>

          <div className="py-4 text-sm text-gray-500">
            {t('voucher.confirmExportVouchers')}
            <br />
          </div>
        </DialogHeader>
        <DialogFooter className="flex flex-row gap-2 justify-center">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border border-gray-300 min-w-24"
          >
            {tCommon('common.cancel')}
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? tCommon('common.loading') : t('voucher.exportVouchers')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
