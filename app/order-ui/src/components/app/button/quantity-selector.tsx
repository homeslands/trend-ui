import { Minus, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui'
import { useOrderFlowStore } from '@/stores'
import { IOrderDetail, IOrderItem } from '@/types'

export const MAX_ITEM_QUANTITY = 20

interface QuantitySelectorProps {
  cartItem: IOrderDetail | IOrderItem
  onRequestRemove?: () => void
  // Trần số lượng mặc định là MAX_ITEM_QUANTITY (20) — hợp lý cho khách đặt món
  // thông thường. Các màn nhân viên (đơn nhóm/sự kiện) có thể cần trần cao hơn;
  // để nguyên component dùng chung, cho phép nơi gọi tự nâng trần qua prop này
  // thay vì phải sửa hằng số hardcode trong file dùng chung.
  maxQuantity?: number
}

export default function QuantitySelector({
  cartItem,
  onRequestRemove,
  maxQuantity = MAX_ITEM_QUANTITY,
}: QuantitySelectorProps) {
  const { t } = useTranslation('menu')
  // Đọc thẳng từ store: giữ state cục bộ sẽ lệch khi giỏ bị đổi từ nơi khác.
  const quantity = cartItem.quantity
  const updateOrderingItemQuantity = useOrderFlowStore(
    (state) => state.updateOrderingItemQuantity,
  )

  // Nhiều nơi dùng component này chưa truyền onRequestRemove (đã có sẵn nút xoá
  // riêng cạnh bên, vd DeleteCartItemDialog). Chỉ đổi nút giảm thành nút xoá khi
  // có callback thật — nếu không, nút giảm ở số lượng 1 giữ nguyên hành vi cũ
  // (icon Minus, bấm không làm gì) để tránh biến thành nút thùng rác chết.
  const canRemove = typeof onRequestRemove === 'function'
  const showRemove = quantity <= 1 && canRemove

  const handleDecrement = () => {
    if (quantity <= 1) {
      // `?.()` đã tự no-op khi onRequestRemove là undefined — không cần bọc `if`.
      onRequestRemove?.()
      return
    }
    updateOrderingItemQuantity(cartItem.id!, quantity - 1)
  }

  const handleIncrement = () => {
    if (quantity >= maxQuantity) return
    updateOrderingItemQuantity(cartItem.id!, quantity + 1)
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border p-0.5">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDecrement}
        aria-label={showRemove ? t('menu.removeItem') : t('menu.decreaseQuantity')}
        className="rounded-full h-7 w-7 hover:bg-muted"
      >
        {showRemove ? <Trash2 size={12} /> : <Minus size={12} />}
      </Button>
      <span className="w-5 text-xs font-semibold text-center tabular-nums">{quantity}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleIncrement}
        disabled={quantity >= maxQuantity}
        aria-label={t('menu.increaseQuantity')}
        className="rounded-full h-7 w-7 hover:bg-muted"
      >
        <Plus size={12} />
      </Button>
    </div>
  )
}
