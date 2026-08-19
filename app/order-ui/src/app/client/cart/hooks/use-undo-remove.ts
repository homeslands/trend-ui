import { useCallback, useEffect, useRef } from 'react'

import { useOrderFlowStore } from '@/stores'
import { IOrderItem, IVoucher } from '@/types'

/** Khoảng thời gian khách còn bấm được "Hoàn tác" sau khi xoá một món. */
export const UNDO_WINDOW_MS = 5000

export interface IUndoEntry {
  /** Khoá duy nhất cho một lần xoá — cũng được dùng làm id của toast. */
  key: string
  /** Bản chụp NGUYÊN VẸN dòng hàng lúc bị xoá (giữ nguyên quantity, note, variant). */
  item: IOrderItem
  /** Vị trí của dòng hàng trong giỏ ngay trước khi xoá. */
  index: number
  /** Voucher đang áp dụng lúc xoá — dùng để khôi phục nếu lần xoá này làm mất voucher. */
  voucher: IVoucher | null
}

interface IUseUndoRemoveOptions {
  windowMs?: number
  /**
   * Gọi khi một entry KHÔNG CÒN hoàn tác được nữa — hết giờ, hoặc trang bị unmount
   * trong lúc cửa sổ còn mở. Trang dùng nó để đóng toast tương ứng.
   *
   * Nhánh unmount là bắt buộc, không phải cho đẹp: toast sống ngoài cây React của
   * trang (`<Toaster/>` ở `main.tsx`) nên nó KHÔNG tự biến mất khi khách rời `/cart`,
   * mà react-hot-toast còn dừng đếm giờ khi con trỏ ở trên toast. Không đóng ở đây thì
   * còn lại một nút "Hoàn tác" bấm vào không làm gì trong khi món đã mất thật.
   */
  onExpire?: (entry: IUndoEntry) => void
}

export interface IUseUndoRemove {
  /**
   * Xoá món khỏi giỏ và mở một cửa sổ hoàn tác. Trả về entry (để hiện toast) hoặc
   * `null` nếu không có gì để xoá.
   */
  removeWithUndo: (item: IOrderItem) => IUndoEntry | null
  /** Khôi phục món của `key`. Trả về `true` nếu thật sự khôi phục được. */
  undo: (key: string) => boolean
}

let undoSequence = 0

/**
 * Logic "xoá món + Hoàn tác" của trang giỏ hàng.
 *
 * Vì sao KHÔNG dùng một ô `pendingUndo` duy nhất như bản phác trong brief: nếu khách
 * xoá món A rồi xoá tiếp món B trong vòng 5 giây, ô duy nhất đó bị B ghi đè và A mất
 * vĩnh viễn dù cửa sổ hoàn tác của A chưa hết hạn. Ở đây mỗi lần xoá là một entry
 * riêng có timer riêng, nên mọi món bị xoá trong cửa sổ đều hoàn tác được, đúng thứ tự
 * nào cũng được.
 *
 * Mọi thao tác đọc/ghi store đều qua `useOrderFlowStore.getState()` thay vì giá trị
 * đóng băng trong closure: handler chạy sau nhiều lần render, đọc state cũ là cách
 * `index` bị tính sai (và là lỗi tiềm ẩn trong bản phác của brief, nơi `cart` nằm
 * trong dependency của `useCallback`).
 */
export function useUndoRemove(options?: IUseUndoRemoveOptions): IUseUndoRemove {
  const windowMs = options?.windowMs ?? UNDO_WINDOW_MS
  const entriesRef = useRef(new Map<string, IUndoEntry>())
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // Giữ callback trong ref để `removeWithUndo` không đổi tham chiếu mỗi render khi
  // người gọi truyền hàm inline.
  const onExpireRef = useRef(options?.onExpire)
  onExpireRef.current = options?.onExpire

  const forget = useCallback((key: string) => {
    const timer = timersRef.current.get(key)
    if (timer) clearTimeout(timer)
    timersRef.current.delete(key)
    entriesRef.current.delete(key)
  }, [])

  // Rời trang khi còn cửa sổ hoàn tác đang chạy: dọn timer (nếu không setTimeout vẫn
  // nổ sau khi component đã unmount, giữ luôn tham chiếu tới IOrderItem trong bộ nhớ)
  // VÀ báo cho người gọi đóng từng toast — sau `entries.clear()` thì `undo()` chỉ còn
  // trả `false`, để toast sống tiếp là để lại một nút bấm không làm gì.
  useEffect(() => {
    const timers = timersRef.current
    const entries = entriesRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
      entries.forEach((entry) => onExpireRef.current?.(entry))
      entries.clear()
    }
  }, [])

  const removeWithUndo = useCallback(
    (item: IOrderItem): IUndoEntry | null => {
      const current = useOrderFlowStore.getState().orderingData
      if (!current) return null

      const index = current.orderItems.findIndex((i) => i.id === item.id)
      if (index < 0) return null

      // Chụp bản trong store chứ không dùng thẳng `item` từ props: đây là nguồn duy
      // nhất chắc chắn có quantity/note/variant mới nhất tại thời điểm xoá.
      const snapshot = current.orderItems[index]
      const voucher = current.voucher ?? null
      const isLastItem = current.orderItems.length === 1

      useOrderFlowStore.getState().removeCartItem(item.id)

      // Giữ nguyên hành vi của DeleteCartItemDialog (thứ vừa bị thay bằng toast này):
      // xoá món CUỐI CÙNG thì gỡ luôn voucher, để voucher cũ không dính lại vào giỏ
      // khi khách thêm món mới.
      if (isLastItem && voucher) useOrderFlowStore.getState().removeVoucher()

      undoSequence += 1
      const entry: IUndoEntry = { key: `${snapshot.id}:${undoSequence}`, item: snapshot, index, voucher }
      entriesRef.current.set(entry.key, entry)
      timersRef.current.set(
        entry.key,
        setTimeout(() => {
          forget(entry.key)
          onExpireRef.current?.(entry)
        }, windowMs),
      )

      return entry
    },
    [forget, windowMs],
  )

  const undo = useCallback(
    (key: string): boolean => {
      const entry = entriesRef.current.get(key)
      if (!entry) return false
      forget(key)

      const current = useOrderFlowStore.getState().orderingData
      if (!current) return false
      // Khách có thể đã tự thêm lại món từ trang menu trong 5 giây đó — chèn thêm lần
      // nữa sẽ tạo hai dòng cùng id (trùng key React, sai số lượng).
      if (current.orderItems.some((i) => i.id === entry.item.id)) return false

      const items = [...current.orderItems]
      // Giỏ có thể đã ngắn đi (xoá thêm món khác) nên index cũ vượt quá mảng; splice
      // tự chèn vào cuối, `Math.min` chỉ làm ý định đó tường minh.
      items.splice(Math.min(entry.index, items.length), 0, entry.item)

      useOrderFlowStore.getState().setOrderingData({
        ...current,
        orderItems: items,
        // Khôi phục voucher nếu chính lần xoá này (hoặc guard voucher chạy ngay sau
        // nó) đã gỡ voucher đi. Không ghi đè voucher hiện tại nếu khách đã chọn cái
        // khác trong lúc đó.
        voucher: current.voucher ?? entry.voucher,
      })

      return true
    },
    [forget],
  )

  return { removeWithUndo, undo }
}
