import { useCallback, useEffect } from 'react'
import _ from 'lodash'
import { Helmet } from 'react-helmet'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

import { DeleteAllCartDialog } from '@/components/app/dialog'
import { OrderNoteInput } from '@/components/app/input'
import { VoucherListSheet } from '@/components/app/sheet'
import { Button } from '@/components/ui'
import { OrderFlowStep, useOrderFlowStore } from '@/stores'
import { IOrderItem, OrderTypeEnum } from '@/types'

import {
  CartActions,
  CartEmpty,
  CartErrorBoundary,
  CartItemRow,
  CartSummary,
  FulfillmentFields,
  OrderTypeTabs,
} from './components'
import { useCartBlockers } from './hooks/use-cart-blockers'
import { useCartPricing } from './hooks/use-cart-pricing'
import { useCrossTabCartSync } from './hooks/use-cross-tab-cart-sync'
import { useCartRevalidation } from './hooks/use-cart-revalidation'
import { useCartVoucherGuard } from './hooks/use-cart-voucher-guard'
import { UNDO_WINDOW_MS, useUndoRemove } from './hooks/use-undo-remove'

const SECTION_CLASS = 'rounded-md border bg-white p-4 dark:bg-transparent'
const SECTION_TITLE_CLASS = 'text-sm font-semibold text-muted-foreground'

function CartPageContent() {
  const { t } = useTranslation('menu')
  const { t: tHelmet } = useTranslation('helmet')

  const cart = useOrderFlowStore((state) => state.orderingData)
  const currentStep = useOrderFlowStore((state) => state.currentStep)

  const { soldOutItemIds } = useCartRevalidation()
  const pricing = useCartPricing()
  const blockers = useCartBlockers(soldOutItemIds)
  useCartVoucherGuard()
  useCrossTabCartSync()

  // Toast hoàn tác dùng chính hệ thống toast của app (`<Toaster />` trong main.tsx,
  // mặc định top-center). Lý do không tự vẽ một khối `fixed bottom-*` trong trang: dưới
  // đáy màn hình mobile đã có bottom-nav (fixed, 5rem) VÀ thanh CartActions dính đáy —
  // toast tự vẽ sẽ nằm đè lên nút "Đặt hàng", biến nút Hoàn tác thành bẫy bấm nhầm.
  const { removeWithUndo, undo } = useUndoRemove({
    // Hết cửa sổ hoàn tác thì tắt luôn toast: react-hot-toast tạm dừng đếm giờ khi con
    // trỏ ở trên toast, nếu không đồng bộ sẽ còn một nút "Hoàn tác" bấm vào không làm gì.
    onExpire: (entry) => toast.dismiss(entry.key),
  })

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const handleRemove = useCallback(
    (item: IOrderItem) => {
      const entry = removeWithUndo(item)
      if (!entry) return

      toast.custom(
        // `ariaProps` (`role="status"`, `aria-live="polite"`) chỉ được react-hot-toast tự
        // gắn cho `ToastBar` — toast custom thì KHÔNG. Phải tự spread, nếu không người
        // dùng trình đọc màn hình xoá món mà không nghe thấy gì và cũng không có đường
        // tới nút Hoàn tác (trang này đã bỏ bước xác nhận của DeleteCartItemDialog).
        (instance) => (
          <div
            {...instance.ariaProps}
            className="flex gap-3 items-center px-3 py-2 w-full max-w-sm text-sm text-white rounded-lg shadow-lg bg-neutral-900"
          >
            <span className="truncate">{t('menu.itemRemoved', { name: entry.item.name })}</span>
            <Button
              variant="ghost"
              onClick={() => {
                const restored = undo(entry.key)
                toast.dismiss(entry.key)
                // Không im lặng nuốt thất bại: cửa sổ hoàn tác có thể đã đóng (hết giờ
                // trong lúc con trỏ giữ toast lại) hoặc khách đã tự thêm món đó vào giỏ.
                if (!restored) toast.error(t('menu.undoUnavailable'))
              }}
              className="px-2 ml-auto h-auto font-bold text-primary hover:bg-white/10"
            >
              {t('menu.undo')}
            </Button>
          </div>
        ),
        { id: entry.key, duration: UNDO_WINDOW_MS },
      )
    },
    [removeWithUndo, undo, t],
  )

  // Món giá tự nhập không cộng dồn được với voucher (giữ nguyên quy tắc của trang cũ:
  // toàn bộ khối voucher bị ẩn khi giỏ có món như vậy).
  const hasCustomPriceItems = cart?.orderItems.some((item) => item.isCustomPrice) ?? false

  // `orderingData` không tự xoá khi rời bước ORDERING (chỉ `transitionToPayment` gọi
  // `clearOrderingData`; `initializeUpdating` — bước sửa một đơn cũ — thì không). Trang
  // cũ đọc giỏ qua `getCartItems()`, hàm trả `null` khi `currentStep !== ORDERING` nên tự
  // chặn được; trang này đọc thẳng `orderingData` ở nhiều nơi nên cần guard riêng: nếu
  // khách đang ở bước UPDATING (hoặc PAYMENT) mà mở /cart, không được thấy giỏ cũ.
  if (currentStep !== OrderFlowStep.ORDERING) return <CartEmpty />

  // `useCartBlockers` cố tình KHÔNG chặn khi giỏ rỗng — guard này là thứ duy nhất ngăn
  // khách đi tiếp với giỏ trống, phải nằm trước mọi thứ khác.
  if (_.isEmpty(cart?.orderItems)) return <CartEmpty />

  return (
    <div className="container py-6 lg:py-10">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.cart.title')}</title>
        <meta name="description" content={tHelmet('helmet.cart.title')} />
      </Helmet>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-5">
        <div className="flex flex-col gap-3 min-w-0">
          <section className={SECTION_CLASS}>
            <div className="flex gap-2 justify-between items-center mb-3">
              <h2 className={SECTION_TITLE_CLASS}>{t('menu.fulfillmentTitle')}</h2>
              <DeleteAllCartDialog />
            </div>
            <OrderTypeTabs />
            <div className="mt-3">
              <FulfillmentFields />
            </div>
            {/* Ghi chú "nhiều đơn có thể đặt chung một bàn" của trang cũ. Trang cũ hiện
                nó màu đỏ cho MỌI loại đơn (kể cả giao hàng) dù chỉ nói về bàn; ở đây chỉ
                hiện cho đơn tại bàn và để màu phụ, vì việc "chưa chọn bàn" đã có blocker
                riêng ngay trên nút đặt hàng. */}
            {cart?.type === OrderTypeEnum.AT_TABLE && (
              <p className="mt-2 text-xs italic text-muted-foreground">
                {t('order.selectTableNote')}
              </p>
            )}
          </section>

          <div className="flex flex-col gap-2.5">
            {cart?.orderItems.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                display={pricing.displayMap.get(item.id)}
                isSoldOut={soldOutItemIds.includes(item.id)}
                onRemove={handleRemove}
              />
            ))}
          </div>

          <section className={SECTION_CLASS}>
            <h2 className={`mb-2 ${SECTION_TITLE_CLASS}`}>{t('order.note')}</h2>
            <OrderNoteInput order={cart} />
          </section>

          {!hasCustomPriceItems && (
            <section className={SECTION_CLASS}>
              <h2 className={`mb-2 ${SECTION_TITLE_CLASS}`}>{t('order.voucher')}</h2>
              <VoucherListSheet />
            </section>
          )}
        </div>

        {/* `contents` (mobile) làm div này KHÔNG sinh hộp, nên CartSummary và CartActions
            trở thành con trực tiếp của cột flex bao cả trang. Đó là điều kiện để
            `sticky bottom-*` của CartActions bám đáy màn hình suốt cả trang: một phần tử
            sticky chỉ trượt được trong phạm vi hộp cha của nó, nếu bọc trong một cột con
            (hoặc một wrapper vừa khít) thì nó chỉ "dính" ở đúng vài trăm pixel cuối trang
            — tức là mất hẳn thanh đặt hàng luôn hiện của bản cũ.
            Từ `lg` trở lên, `lg:flex` ghi đè `contents`: hai khối gộp lại thành cột phải
            dính theo `lg:sticky lg:top-20` (CartActions tự tắt nền/viền/sticky ở `lg`). */}
        <div className="contents lg:sticky lg:top-20 lg:flex lg:min-w-0 lg:flex-col lg:gap-3">
          <CartSummary pricing={pricing} />
          <CartActions pricing={pricing} blockers={blockers} />
        </div>
      </div>
    </div>
  )
}

export default function ClientCartPage() {
  return (
    <CartErrorBoundary>
      <CartPageContent />
    </CartErrorBoundary>
  )
}
