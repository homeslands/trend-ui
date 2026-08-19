import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useOrderFlowStore } from '@/stores'
import { useCrossTabCartSync } from '../use-cross-tab-cart-sync'

describe('useCrossTabCartSync', () => {
  let rehydrate: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    rehydrate = vi.spyOn(useOrderFlowStore.persist, 'rehydrate').mockResolvedValue(undefined)
  })

  afterEach(() => {
    rehydrate.mockRestore()
  })

  function fireStorage(key: string | null) {
    window.dispatchEvent(new StorageEvent('storage', { key }))
  }

  it('tab khác ghi giỏ hàng thì nạp lại state từ localStorage', () => {
    renderHook(() => useCrossTabCartSync())

    fireStorage('order-flow-store')

    expect(rehydrate).toHaveBeenCalledTimes(1)
  })

  it('bỏ qua thay đổi của khoá khác', () => {
    renderHook(() => useCrossTabCartSync())

    fireStorage('auth-storage')
    fireStorage(null) // localStorage.clear()

    expect(rehydrate).not.toHaveBeenCalled()
  })

  it('gỡ listener khi rời trang, không nạp lại nữa', () => {
    const { unmount } = renderHook(() => useCrossTabCartSync())

    unmount()
    fireStorage('order-flow-store')

    expect(rehydrate).not.toHaveBeenCalled()
  })
})
