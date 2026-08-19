import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import { useSyncTableFromUrl } from '../use-sync-table-from-url'

vi.mock('@/hooks/use-table', () => ({
  useTables: () => ({
    data: { result: [{ slug: 'ban-a01', name: 'A01', status: 'available' }] },
  }),
}))

function makeWrapper(entry: string) {
  return function wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  }
}

describe('useSyncTableFromUrl', () => {
  beforeEach(() => {
    useOrderFlowStore.getState().initializeOrdering()
  })

  it('ghi bàn từ query param vào order-flow store', () => {
    renderHook(() => useSyncTableFromUrl(), {
      wrapper: makeWrapper('/cart?branch=chi-nhanh-1&table=ban-a01'),
    })

    const data = useOrderFlowStore.getState().orderingData
    expect(data?.table).toBe('ban-a01')
    expect(data?.tableName).toBe('A01')
  })

  it('không có ?table= trong URL thì không đặt bàn', () => {
    renderHook(() => useSyncTableFromUrl(), {
      wrapper: makeWrapper('/cart'),
    })

    const data = useOrderFlowStore.getState().orderingData
    expect(data?.table).toBeFalsy()
  })

  it('?table= không khớp bàn nào thì không đặt bàn', () => {
    renderHook(() => useSyncTableFromUrl(), {
      wrapper: makeWrapper('/cart?branch=chi-nhanh-1&table=ban-khong-ton-tai'),
    })

    const data = useOrderFlowStore.getState().orderingData
    expect(data?.table).toBeFalsy()
  })

  it('quét QR lúc giỏ đang trống (orderingData null) vẫn phải khởi tạo giỏ và ghi bàn', () => {
    useOrderFlowStore.getState().clearOrderingData()
    expect(useOrderFlowStore.getState().orderingData).toBeNull()

    renderHook(() => useSyncTableFromUrl(), {
      wrapper: makeWrapper('/cart?branch=chi-nhanh-1&table=ban-a01'),
    })

    const data = useOrderFlowStore.getState().orderingData
    expect(data).not.toBeNull()
    expect(data?.table).toBe('ban-a01')
  })

  it('quét QR tại bàn chuyển loại đơn đang Giao hàng sang Tại bàn (có chủ đích)', () => {
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.DELIVERY)

    renderHook(() => useSyncTableFromUrl(), {
      wrapper: makeWrapper('/cart?branch=chi-nhanh-1&table=ban-a01'),
    })

    const data = useOrderFlowStore.getState().orderingData
    expect(data?.type).toBe(OrderTypeEnum.AT_TABLE)
    expect(data?.table).toBe('ban-a01')
  })
})
