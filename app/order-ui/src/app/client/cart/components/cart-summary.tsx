import { useTranslation } from 'react-i18next'

import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import { formatCurrency } from '@/utils'

import { ICartPricing } from '../hooks/use-cart-pricing'

interface CartSummaryProps {
  pricing: ICartPricing
}

export default function CartSummary({ pricing }: CartSummaryProps) {
  const { t } = useTranslation('menu')
  const cart = useOrderFlowStore((state) => state.orderingData)
  const isDelivery = cart?.type === OrderTypeEnum.DELIVERY

  return (
    <section className="p-4 bg-white rounded-md border dark:bg-transparent">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
        {t('order.totalPayment')}
      </h2>

      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <div className="flex justify-between">
          <span>{t('order.subtotalBeforeDiscount')}</span>
          <span className="tabular-nums">{formatCurrency(pricing.subTotalBeforeDiscount)}</span>
        </div>

        {pricing.promotionDiscount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>{t('order.promotionDiscount')}</span>
            <span className="tabular-nums">−{formatCurrency(pricing.promotionDiscount)}</span>
          </div>
        )}

        {pricing.voucherDiscount > 0 && (
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-green-600">
              <span>
                {t('order.voucherDiscount')} {cart?.voucher?.code ? `· ${cart.voucher.code}` : ''}
              </span>
              <span className="tabular-nums">−{formatCurrency(pricing.voucherDiscount)}</span>
            </div>
            {/* Giải thích cho khách vì sao số tiền giảm ít hơn giá trị voucher họ kỳ
                vọng — khôi phục từ page.tsx cũ (dòng 433-435 / 661-663), vốn bị mất khi
                dựng lại component. */}
            <span className="text-xs italic text-muted-foreground">
              ({t('order.partialAppliedNote')})
            </span>
          </div>
        )}

        {/* Neo dòng hiển thị vào CHÍNH con số được cộng vào tổng, không neo vào
            `cart.type` — hai nguồn khác nhau trôi lệch nhau đúng là cách P0-1 sinh ra.
            `isDelivery` được giữ lại để đơn giao hàng chưa có địa chỉ (`deliveryFee === 0`)
            vẫn thấy dòng phí kèm gợi ý nhập địa chỉ ngay dưới, thay vì bị ẩn hoàn toàn.
            Bất biến: fee > 0 thì LUÔN có dòng, không ngoại lệ. */}
        {(isDelivery || pricing.deliveryFee > 0) && (
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span>{t('order.deliveryFee')}</span>
              <span className="tabular-nums">
                {pricing.isDeliveryFeePending
                  ? t('order.calculatingFee')
                  : pricing.deliveryFee > 0
                    ? formatCurrency(pricing.deliveryFee)
                    : '—'}
              </span>
            </div>
            {/* Gợi ý "nhập địa chỉ" chỉ đúng khi thật sự CHƯA có địa chỉ. Trong lúc phí
                đang được tính (đã có địa chỉ rồi) mà vẫn hiện câu này thì nó nói dối
                khách và làm họ tưởng thao tác vừa rồi không ăn. */}
            {isDelivery && pricing.deliveryFee === 0 && !pricing.isDeliveryFeePending && (
              <span className="text-xs italic text-muted-foreground">
                {t('order.enterAddressForFee')}
              </span>
            )}
          </div>
        )}

        <div className="flex justify-between items-baseline pt-3 mt-1 font-semibold border-t text-foreground">
          <span>{t('order.totalPayment')}</span>
          <span className="text-xl font-bold text-primary tabular-nums">
            {formatCurrency(pricing.finalTotal)}
          </span>
        </div>
      </div>

      {pricing.savedTotal > 0 && (
        <p className="px-3 py-2 mt-3 text-xs text-center text-green-600 rounded-md bg-green-600/10">
          {t('order.youSaved')}{' '}
          <b className="tabular-nums">{formatCurrency(pricing.savedTotal)}</b>
        </p>
      )}
    </section>
  )
}
