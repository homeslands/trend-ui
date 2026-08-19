import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CreateOrderDialog } from '@/components/app/dialog'
import { formatCurrency } from '@/utils'

import { ICartBlocker } from '../hooks/use-cart-blockers'
import { ICartPricing } from '../hooks/use-cart-pricing'

interface CartActionsProps {
  pricing: ICartPricing
  blockers: ICartBlocker[]
}

export default function CartActions({ pricing, blockers }: CartActionsProps) {
  const { t } = useTranslation('menu')

  // Ba `id` mục tiêu được gắn ở Task 11: `cart-field-table` trên SelectTrigger (thẻ
  // <button>), `cart-field-address` / `cart-field-phone` trên <input>. `Element` (kiểu
  // trả về của getElementById) không có `.focus()` — chỉ `HTMLElement` mới có, nên guard
  // `instanceof HTMLElement` là đúng và đủ cho cả hai loại phần tử trên (cả
  // HTMLButtonElement lẫn HTMLInputElement đều kế thừa HTMLElement).
  const focusTarget = (targetId: string) => {
    const el = document.getElementById(targetId)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    if (el instanceof HTMLElement) el.focus({ preventScroll: true })
  }

  return (
    // Thanh hành động dính đáy màn hình trên mobile: `-mx-4` + `px-4` cho nền/viền tràn
    // hết chiều ngang (bù lại padding của container cha) trong khi nội dung bên trong vẫn
    // thẳng hàng với phần còn lại của trang; `lg:static` + các lớp `lg:` khác tắt hẳn hành
    // vi sticky/nền/viền ở màn rộng vì desktop đã có `CartSummary` cố định hiển thị tổng
    // tiền, không cần thanh dính đáy nữa.
    //
    // Độ lệch đáy KHÔNG phải 0 dưới `md`: layout khách (`client-shell.tsx`) treo
    // `BottomBarStatic` ở `fixed bottom-0` cao 5rem + `env(safe-area-inset-bottom)`, z-20.
    // `bottom-0` sẽ ghim thanh này ĐÚNG SAU thanh điều hướng đó (z-10 < z-20) — `pb` của
    // layout cha chỉ chừa chỗ cho nội dung trong luồng, không cứu được phần tử sticky vốn
    // neo theo khung nhìn. Từ `md` trở lên bottom-nav không được render nữa (`useIsMobile`
    // dùng ngưỡng 768px) nên trả về `bottom-0`, và lúc đó mới cần tự chừa safe-area.
    <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex flex-col gap-2 -mx-4 border-t bg-white px-4 pb-4 pt-3 dark:bg-background md:bottom-0 md:pb-[calc(1rem+env(safe-area-inset-bottom))] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:pt-0 dark:lg:bg-transparent">
      {blockers.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {blockers.map((blocker) => {
            const text = `${t('menu.blockerPrefix')}: ${blocker.label}`
            const base =
              'flex gap-2 items-center px-3 py-2 w-full text-xs text-left rounded-md text-destructive bg-destructive/10'

            // Lý do không có ô nào để sửa (vd. chưa chọn chi nhánh) hiện dạng chữ. Dựng
            // nút cho nó sẽ là một nút bấm vào không xảy ra gì — tệ hơn là không có nút.
            if (!blocker.targetId) {
              return (
                <li key={blocker.code}>
                  <p className={base}>{text}</p>
                </li>
              )
            }

            return (
              <li key={blocker.code}>
                <button
                  type="button"
                  onClick={() => focusTarget(blocker.targetId as string)}
                  className={`${base} border border-transparent hover:border-destructive`}
                >
                  <span>{text}</span>
                  <ChevronRight size={14} className="ml-auto opacity-70" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex justify-between items-baseline text-sm text-muted-foreground lg:hidden">
        <span>{t('order.totalPayment')}</span>
        <b className="text-lg text-primary tabular-nums">{formatCurrency(pricing.finalTotal)}</b>
      </div>

      <CreateOrderDialog
        disabled={blockers.length > 0}
        disabledText={blockers.length > 0 ? blockers[0].label : undefined}
        totalAmount={pricing.finalTotal}
        deliveryFee={pricing.deliveryFee}
      />
    </div>
  )
}
