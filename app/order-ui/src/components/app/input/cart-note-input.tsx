import { NotepadText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'

import { Input } from '@/components/ui'
import { useOrderFlowStore } from '@/stores'
import { IOrderItem } from '@/types'

const NOTE_MAX_LENGTH = 120
const DEBOUNCE_MS = 300

interface CartNoteInputProps {
  cartItem: IOrderItem
}

export default function CartNoteInput({ cartItem }: CartNoteInputProps) {
  const { t } = useTranslation('menu')
  const addNote = useOrderFlowStore((state) => state.addNote)
  const [value, setValue] = useState(cartItem?.note || '')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // Giá trị mới nhất chưa kịp ghi vào store (debounce timer chưa chạy). Giữ
  // trong ref (không phải state) vì chỉ cần đọc lúc flush, không cần trigger
  // re-render riêng cho việc theo dõi giá trị chờ ghi.
  const pendingRef = useRef<string | null>(null)
  // "Latest ref" cho addNote/cartItem.id: closure của cleanup effect (chạy lúc
  // unmount) chỉ được tạo 1 lần lúc mount nếu deps rỗng, nên phải đọc qua ref để
  // flush() luôn dùng giá trị addNote/id mới nhất chứ không phải bản chụp cũ.
  const addNoteRef = useRef(addNote)
  addNoteRef.current = addNote
  const itemIdRef = useRef(cartItem.id)
  itemIdRef.current = cartItem.id

  const flush = useCallback(() => {
    clearTimeout(timerRef.current)
    if (pendingRef.current !== null) {
      addNoteRef.current(itemIdRef.current, pendingRef.current)
      pendingRef.current = null
    }
  }, [])

  // Ghi thẳng vào store mỗi ký tự sẽ render lại toàn trang và ghi localStorage
  // mỗi lần gõ; debounce để chỉ ghi khi khách dừng nhập. Flush khi unmount (rời
  // trang / đóng drawer / bấm "Đặt hàng") để không mất ghi chú đang gõ dở khi
  // chưa hết 300ms — trước đây cleanup chỉ huỷ timer nên ghi chú bị mất im lặng.
  useEffect(() => () => flush(), [flush])

  // `value` là state cục bộ tách khỏi store nên có thể lệch nếu store đổi từ nơi
  // khác (vd cart-drawer.tsx key theo `item.slug`, không phải `item.id`: xoá rồi
  // thêm lại cùng sản phẩm sẽ khiến React tái dùng component này cho một
  // cartItem.id MỚI ở cùng vị trí danh sách). Khi id đổi: huỷ timer và BỎ giá trị
  // đang chờ — không cố flush sang id cũ, vì id chỉ đổi khi item cũ đã bị xoá
  // khỏi store (updateOrderingNote không tìm thấy id sẽ là no-op), nên flush sang
  // id cũ không cứu được gì mà chỉ thêm độ phức tạp theo dõi "id trước đó".
  useEffect(() => {
    clearTimeout(timerRef.current)
    pendingRef.current = null
    setValue(cartItem?.note || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItem.id])

  const handleNoteChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setValue(next)
    pendingRef.current = next
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      addNote(cartItem.id, next)
      pendingRef.current = null
    }, DEBOUNCE_MS)
  }

  return (
    <div className="flex w-full flex-row items-center justify-center gap-2.5">
      <div className="flex flex-row flex-1 gap-2 justify-between items-center w-full">
        <NotepadText className="text-muted-foreground" size={16} />
        <Input
          value={value}
          maxLength={NOTE_MAX_LENGTH}
          type="text"
          className="h-7 text-[11px] xl:text-sm shadow-none dark:border-muted-foreground/60"
          placeholder={t('order.enterNote')}
          onChange={handleNoteChange}
          onBlur={flush}
        />
      </div>
    </div>
  )
}
