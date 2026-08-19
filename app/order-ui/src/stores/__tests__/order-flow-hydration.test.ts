import { describe, it, expect } from 'vitest'
import { useOrderFlowStore } from '@/stores'

describe('order flow hydration', () => {
  it('đặt isHydrated = true kể cả khi rehydrate trả về lỗi', async () => {
    useOrderFlowStore.setState({ isHydrated: false })

    // Mô phỏng nhánh lỗi của persist: state = undefined, error khác undefined.
    const callback = useOrderFlowStore.persist.getOptions().onRehydrateStorage?.(
      useOrderFlowStore.getState(),
    )
    callback?.(undefined, new Error('localStorage hỏng'))

    await new Promise((resolve) => queueMicrotask(() => resolve(null)))
    expect(useOrderFlowStore.getState().isHydrated).toBe(true)
  })
})
