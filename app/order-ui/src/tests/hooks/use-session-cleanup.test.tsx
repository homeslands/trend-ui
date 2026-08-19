import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// vi.mock được hoist lên đầu file, nên các mock phải tạo bằng vi.hoisted
// thì factory mới đọc được chúng.
const {
  setLogout,
  removeBranch,
  clearCart,
  clearMenuFilter,
  clearMenuItems,
  clearAllData,
  clearSelectedChefOrder,
  removeUserInfo,
  clearUserData,
  setDeviceToken,
  getDeviceToken,
  unregisterDeviceToken,
  clearQueue,
  stopScheduler,
} = vi.hoisted(() => ({
  setLogout: vi.fn(),
  removeBranch: vi.fn(),
  clearCart: vi.fn(),
  clearMenuFilter: vi.fn(),
  clearMenuItems: vi.fn(),
  clearAllData: vi.fn(),
  clearSelectedChefOrder: vi.fn(),
  removeUserInfo: vi.fn(),
  clearUserData: vi.fn(),
  setDeviceToken: vi.fn(),
  getDeviceToken: vi.fn(),
  unregisterDeviceToken: vi.fn(),
  clearQueue: vi.fn(),
  stopScheduler: vi.fn(),
}))

vi.mock('@/stores', () => ({
  useAuthStore: () => ({ setLogout }),
  useBranchStore: () => ({ removeBranch }),
  useCartItemStore: () => ({ clearCart }),
  useMenuFilterStore: () => ({ clearMenuFilter }),
  useMenuItemStore: () => ({ clearMenuItems }),
  useOrderFlowStore: () => ({ clearAllData }),
  useSelectedChefOrderStore: () => ({ clearSelectedChefOrder }),
  useUserStore: () => ({
    removeUserInfo,
    clearUserData,
    setDeviceToken,
    getDeviceToken,
  }),
}))

vi.mock('@/api/notification', () => ({
  unregisterDeviceToken: (token: string) => unregisterDeviceToken(token),
}))

vi.mock('@/services/token-registration-queue', () => ({
  tokenRegistrationQueue: { clearQueue },
}))

vi.mock('@/services/fcm-token-manager', () => ({
  fcmTokenManager: { stopScheduler },
}))

import { useSessionCleanup } from '@/hooks/use-session-cleanup'

describe('useSessionCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDeviceToken.mockReturnValue('device-token-1')
    unregisterDeviceToken.mockResolvedValue(undefined)
    localStorage.setItem('fcm_token_registered_at', '123')
  })

  it('should unregister the device token before any store is cleared', async () => {
    const { result } = renderHook(() => useSessionCleanup())

    await act(async () => {
      await result.current()
    })

    expect(unregisterDeviceToken).toHaveBeenCalledWith('device-token-1')
    expect(unregisterDeviceToken.mock.invocationCallOrder[0]).toBeLessThan(
      clearUserData.mock.invocationCallOrder[0],
    )
  })

  it('should stop the notification machinery and drop its timestamp', async () => {
    const { result } = renderHook(() => useSessionCleanup())

    await act(async () => {
      await result.current()
    })

    expect(clearQueue).toHaveBeenCalled()
    expect(stopScheduler).toHaveBeenCalled()
    expect(localStorage.getItem('fcm_token_registered_at')).toBeNull()
  })

  it('should clear every store holding the previous user data', async () => {
    const { result } = renderHook(() => useSessionCleanup())

    await act(async () => {
      await result.current()
    })

    expect(setLogout).toHaveBeenCalled()
    expect(removeUserInfo).toHaveBeenCalled()
    expect(clearUserData).toHaveBeenCalled()
    expect(removeBranch).toHaveBeenCalled()
    expect(clearCart).toHaveBeenCalled()
    expect(clearAllData).toHaveBeenCalled()
    expect(clearMenuItems).toHaveBeenCalled()
    expect(clearSelectedChefOrder).toHaveBeenCalled()
    expect(clearMenuFilter).toHaveBeenCalled()
    expect(setDeviceToken).toHaveBeenCalledWith('')
  })

  it('should still clear the session when unregistering the token fails', async () => {
    unregisterDeviceToken.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useSessionCleanup())

    await act(async () => {
      await result.current()
    })

    expect(setLogout).toHaveBeenCalled()
    expect(clearCart).toHaveBeenCalled()
  })

  it('should skip the unregister call when there is no device token', async () => {
    getDeviceToken.mockReturnValue(null)
    const { result } = renderHook(() => useSessionCleanup())

    await act(async () => {
      await result.current()
    })

    expect(unregisterDeviceToken).not.toHaveBeenCalled()
    expect(setLogout).toHaveBeenCalled()
  })
})
