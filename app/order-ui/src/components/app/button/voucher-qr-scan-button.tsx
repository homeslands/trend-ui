import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScanLine } from 'lucide-react'

import { Button } from '@/components/ui'
import {
  VoucherHardwareScannerDialog,
  VoucherQrScannerDialog,
} from '@/components/app/dialog'
import { useLookupVoucherByQr } from '@/hooks'
import {
  parseVoucherQrPayload,
  VOUCHER_REJECTION_HINT_KEY,
  type VoucherScanRejection,
} from '@/utils'
import type { ScanRejection } from '@/components/app/dialog'
import { IVoucher } from '@/types'

interface VoucherQrScanButtonProps {
  /** `true` khi người dùng chưa đăng nhập — dùng endpoint voucher công khai. */
  isPublic: boolean
  /**
   * Nhận voucher đã tra được.
   *
   * Trả `true` hoặc không trả gì nghĩa là đã nhận — màn quét đóng. Khi TỪ CHỐI,
   * trả về nhóm lý do (`permanent` / `cart` / `condition`) để màn quét khuyên
   * đúng việc cần làm: mã hết hạn thì bảo thử phiếu khác, chưa đủ giá trị tối
   * thiểu thì bảo thêm món. Trả `false` là từ chối không rõ nhóm.
   */
  onResolved: (voucher: IVoucher) => VoucherScanRejection | boolean | void
  disabled?: boolean
  /**
   * `hardware` cho các màn nhân viên: quét bằng đầu đọc cầm tay, giống màn quét
   * thẻ khách hàng. `camera` cho các màn khách: họ dùng điện thoại của mình và
   * không có đầu đọc nào cả. Mặc định `camera`.
   */
  scannerMode?: 'camera' | 'hardware'
}

/**
 * Nút mở màn quét mã QR voucher và trả về voucher đã tra được.
 *
 * Component này không áp voucher. Mỗi sheet áp voucher theo cách riêng của nó,
 * nên việc áp thuộc về `onResolved` của nơi gọi. Nó cũng không quan tâm chuỗi
 * quét đến từ camera hay đầu đọc — hai dialog dùng chung một hợp đồng, nên
 * phần parse, tra cứu và báo lỗi bên dưới giống hệt nhau ở cả hai chế độ.
 */
export default function VoucherQrScanButton({
  isPublic,
  onResolved,
  disabled,
  scannerMode = 'camera',
}: VoucherQrScanButtonProps) {
  const { t } = useTranslation(['voucher', 'toast'])
  const [isOpen, setIsOpen] = useState(false)
  const { mutateAsync: lookupVoucher, isPending } = useLookupVoucherByQr()

  // Trả `false` ở mọi nhánh hỏng: dialog dùng giá trị này để mở lại chốt quét.
  // Không trả thì dialog đứng im sau lần quét hụt đầu tiên (nó chỉ nhận đúng một
  // khung hình cho tới khi được mở lại chốt).
  const handleScanned = useCallback(
    async (raw: string): Promise<ScanRejection | true> => {
      const identifier = parseVoucherQrPayload(raw)

      // Mọi thông báo của luồng quét đi vào DẢI CHỮ trên màn quét, KHÔNG dùng
      // toast: màn quét chiếm trọn màn hình, bắn thêm toast lên trên là hai khối
      // chữ cùng lúc cho một sự việc — người dùng phản ánh là quá nhiều.
      const reject = (message: string, hint?: string): ScanRejection => ({
        message,
        hint,
        permanent: false,
      })

      // Quét hụt thì KHÔNG đóng dialog: người dùng gần như luôn quét lại ngay,
      // bắt họ bấm mở lại là thừa một nhịp.
      if (!identifier) {
        return reject(
          t('toast.invalidVoucherQrCode', { ns: 'toast' }),
          t('voucher.scanHintTryAnother'),
        )
      }

      try {
        const voucher = await lookupVoucher({ identifier, isPublic })
        // Sheet mới là nơi biết voucher có dùng được cho đơn này không, nên nó
        // quyết định màn quét đóng hay ở lại. Chỉ đóng khi nó thật sự nhận.
        const outcome = onResolved(voucher)
        if (outcome === false) {
          return reject(t('voucher.notValid'), t('voucher.scanHintTryAnother'))
        }
        if (outcome && typeof outcome === 'object') {
          const hintKey = VOUCHER_REJECTION_HINT_KEY[outcome.kind]
          return {
            message: outcome.message,
            // Lời khuyên cụ thể của sheet thắng câu chung theo nhóm: nó nêu
            // đích danh món cần thêm/bỏ, còn câu chung chỉ nói "sửa giỏ hàng".
            hint: outcome.hint ?? (hintKey ? t(hintKey) : undefined),
            hintItems: outcome.hintItems,
            action: outcome.action,
            // Chỉ chặn hẳn mã khi nó không bao giờ dùng được. Lý do phụ thuộc
            // giỏ hàng thì KHÔNG chặn: khách thêm món xong quét lại phải ăn.
            permanent: outcome.kind === 'permanent',
          }
        }

        setIsOpen(false)
        return true
      } catch {
        // Nuốt lỗi có chủ đích: mã không có thật, mạng hỏng hay BE 500 đều ra
        // cùng một câu, vì người đứng quầy không làm gì khác nhau được trong ba
        // trường hợp đó. Đổi lại, chẩn đoán phải dựa vào tab Network chứ không
        // có gì in ra ở đây.
        return reject(
          t('toast.voucherNotFoundFromQrCode', { ns: 'toast' }),
          t('voucher.scanHintTryAnother'),
        )
      }
    },
    [isPublic, lookupVoucher, onResolved, scannerMode],
  )

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled || isPending}
        aria-label={t('voucher.scanQrCode')}
        onClick={() => setIsOpen(true)}
      >
        <ScanLine className="w-4 h-4" />
      </Button>

      {scannerMode === 'hardware' ? (
        <VoucherHardwareScannerDialog
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          onScanned={handleScanned}
        />
      ) : (
        <VoucherQrScannerDialog
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          onScanned={handleScanned}
        />
      )}
    </>
  )
}
