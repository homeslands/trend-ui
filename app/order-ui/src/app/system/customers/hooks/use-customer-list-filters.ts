import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

const setOrDelete = (params: URLSearchParams, key: string, value: string) => {
  if (value) params.set(key, value)
  else params.delete(key)
}

/**
 * Namespace URL riêng cho bảng danh bạ — nhưng CHỈ cho những gì thật sự thuộc về riêng
 * bảng: `page`/`size` (phân trang table-local) và `card` (mã RFID/QR vừa quét).
 *
 * SĐT và khoảng ngày KHÔNG còn ở đây nữa: theo yêu cầu product owner, hai field đó giờ
 * có MỘT nguồn sự thật duy nhất là `useCustomerAnalyticsFilters` (key URL `phone`/
 * `from`/`to`) — bảng danh bạ đọc thẳng từ đó (xem
 * `system-customer-management.tabscontent.tsx`). Hook này KHÔNG được đọc/ghi
 * `phone`/`from`/`to` (hay các key cũ `q`/`tfrom`/`tto`) nữa — đó chính xác là kiểu va
 * chạm key đã gây ra bug trước đây (hai hook vô tình cùng ghi một key URL). Namespace
 * hai hook vẫn tách rời tuyệt đối: chỉ ĐÚNG MỘT nơi (hook analytics) sở hữu
 * phone/from/to.
 */
export interface CustomerListFilters {
  page: number
  size: number
  card: string
  setPage: (page: number) => void
  setSize: (size: number) => void
  setCard: (card: string) => void
  reset: () => void
}

export function useCustomerListFilters(): CustomerListFilters {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Number(searchParams.get('page')) || 1
  const size = Number(searchParams.get('size')) || 10
  const card = searchParams.get('card') || ''

  const update = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          mutate(next)
          return next
        },
        { replace: false },
      )
    },
    [setSearchParams],
  )

  const setPage = useCallback(
    (p: number) => update((params) => params.set('page', String(p))),
    [update],
  )

  const setSize = useCallback(
    (s: number) =>
      update((params) => {
        params.set('size', String(s))
        params.set('page', '1')
      }),
    [update],
  )

  const setCard = useCallback(
    (value: string) =>
      update((params) => {
        setOrDelete(params, 'card', value)
        params.set('page', '1')
      }),
    [update],
  )

  const reset = useCallback(
    () =>
      update((params) => {
        params.delete('card')
        params.set('page', '1')
      }),
    [update],
  )

  return useMemo(
    () => ({
      page, size, card,
      setPage, setSize, setCard, reset,
    }),
    [page, size, card, setPage, setSize, setCard, reset],
  )
}
