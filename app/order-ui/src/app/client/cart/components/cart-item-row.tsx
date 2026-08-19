import { AlertTriangle, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ProductImage } from '@/assets/images'
import { QuantitySelector } from '@/components/app/button'
import { CartNoteInput } from '@/components/app/input'
import { ProductVariantSelect } from '@/components/app/select'
import { Button } from '@/components/ui'
import { publicFileURL, VOUCHER_TYPE } from '@/constants'
import { cn } from '@/lib'
import { useOrderFlowStore } from '@/stores'
import { IDisplayCartItem, IOrderItem } from '@/types'
import { formatCurrency } from '@/utils'

interface CartItemRowProps {
  item: IOrderItem
  display?: IDisplayCartItem
  isSoldOut: boolean
  onRemove: (item: IOrderItem) => void
}

export default function CartItemRow({ item, display, isSoldOut, onRemove }: CartItemRowProps) {
  const { t } = useTranslation('menu')
  const voucher = useOrderFlowStore((state) => state.orderingData?.voucher)
  const changeOrderingItemVariant = useOrderFlowStore((state) => state.changeOrderingItemVariant)

  const original = item.originalPrice || 0
  const unitPrice = display?.finalPrice ?? original
  const hasDiscount = unitPrice < original
  const isSamePriceVoucher =
    voucher?.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT && (display?.voucherDiscount ?? 0) > 0
  // `promotionDiscount` trong IDisplayCartItem là số tiền giảm cho MỘT ĐƠN VỊ (xem
  // calculateCartItemDisplay trong src/utils/cart.ts: được tính từ `original` — cũng là
  // giá một đơn vị — và chỉ nhân với `quantity` sau này ở calculateCartTotals). Vì vậy
  // chia trực tiếp cho `original` (giá gốc một đơn vị) là đúng đơn vị, không cần chia
  // thêm cho quantity.
  const promotionPercent =
    original > 0 ? Math.round(((display?.promotionDiscount ?? 0) / original) * 100) : 0

  return (
    <article
      id={`cart-row-${item.id}`}
      className={cn(
        'grid grid-cols-[64px_minmax(0,1fr)] items-start gap-3 rounded-md border bg-white p-3 dark:bg-transparent sm:grid-cols-[80px_minmax(0,1fr)]',
        isSoldOut && 'border-amber-600 bg-amber-50 dark:bg-amber-950/20',
      )}
    >
      <img
        src={item.image ? `${publicFileURL}/${item.image}` : ProductImage}
        alt={item.name}
        width={80}
        height={80}
        loading="lazy"
        onError={(e) => {
          // Gỡ handler TRƯỚC khi gán fallback: nếu chính ProductImage cũng lỗi tải
          // (404, offline...), không có onerror = null thì onError sẽ tự gọi lại
          // chính nó vô hạn lần vì src vừa đổi vẫn kích hoạt lỗi mới.
          e.currentTarget.onerror = null
          e.currentTarget.src = ProductImage
        }}
        className="object-cover w-full rounded-md aspect-square"
      />

      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex gap-2 items-start">
          <h3 className="text-sm font-semibold truncate">{item.name}</h3>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${t('menu.removeItem')} ${item.name}`}
            onClick={() => onRemove(item)}
            className="ml-auto w-7 h-7 text-muted-foreground hover:text-destructive"
          >
            <Trash2 size={14} />
          </Button>
        </div>

        {isSoldOut && (
          <div className="flex gap-2 items-center px-2 py-1.5 text-xs rounded-md text-amber-700 bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle size={14} />
            <span>{t('menu.soldOutInCart')}</span>
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="ml-auto underline whitespace-nowrap"
            >
              {t('menu.removeSoldOut')}
            </button>
          </div>
        )}

        {(isSamePriceVoucher || promotionPercent > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {isSamePriceVoucher ? (
              <span className="px-2 py-0.5 text-[11px] rounded-full border border-green-600 text-green-600 bg-green-600/10">
                {t('menu.samePriceBadge', { value: formatCurrency(unitPrice) })}
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[11px] rounded-full border border-primary text-primary bg-primary/10">
                {t('menu.promotionBadge', { value: promotionPercent })}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          {item.isCustomPrice ? (
            <span className="text-xs text-muted-foreground">x1</span>
          ) : (
            <>
              <ProductVariantSelect
                variants={item.allVariants}
                value={item.variant?.slug}
                fallbackLabel={item.size}
                onChange={(slug) => changeOrderingItemVariant(item.id, slug)}
              />
              <QuantitySelector cartItem={item} onRequestRemove={() => onRemove(item)} />
            </>
          )}

          <div className="flex gap-1.5 items-baseline">
            {hasDiscount && (
              <span className="text-xs line-through text-muted-foreground tabular-nums">
                {formatCurrency(original)}
              </span>
            )}
            <span className="text-sm font-bold text-primary tabular-nums">
              {formatCurrency(unitPrice)}
            </span>
          </div>

          <span className="ml-auto text-sm font-bold tabular-nums">
            {formatCurrency(unitPrice * item.quantity)}
          </span>
        </div>

        <CartNoteInput cartItem={item} />
      </div>
    </article>
  )
}
