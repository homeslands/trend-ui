import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const setToken = vi.fn()
const setRefreshToken = vi.fn()
const setExpireTime = vi.fn()
const setExpireTimeRefreshToken = vi.fn()
const setLogout = vi.fn()
const setUserInfo = vi.fn()
const removeUserInfo = vi.fn()
const clearCart = vi.fn()
const clearUrl = vi.fn()
const getProfile = vi.fn()
const getAuthScope = vi.fn()
const setQueryData = vi.fn()
const navigate = vi.fn()

vi.mock('@/stores', () => ({
  useAuthStore: () => ({
    setToken,
    setRefreshToken,
    setExpireTime,
    setExpireTimeRefreshToken,
    setLogout,
  }),
  useUserStore: () => ({ setUserInfo, removeUserInfo }),
  useCartItemStore: () => ({ clearCart }),
  useCurrentUrlStore: () => ({ currentUrl: null, clearUrl }),
}))

vi.mock('@/api', () => ({
  getProfile: () => getProfile(),
  getAuthScope: () => getAuthScope(),
}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ setQueryData }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}))

vi.mock('@/utils', () => ({
  calculateSmartNavigationUrl: () => '/',
  safeNavigate: () => true,
}))

import { useHandleAuthSuccess } from '@/hooks/use-post-auth-actions'

const tokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expireTime: '2026-08-11T11:00:00.000Z',
  expireTimeRefreshToken: '2026-08-18T11:00:00.000Z',
}

describe('useHandleAuthSuccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // getProfile() giờ gọi trend (không phải shared-user) — trend tự gọi
    // nội bộ ghép identity, nên profile.result đã có sẵn role/branch đúng.
    // scope chỉ còn dùng để lấy permissions cho tính năng điều hướng.
    getAuthScope.mockResolvedValue({
      result: { role: 'ADMIN', permissions: ['perm-1'] },
    })
  })

  it('should store tokens, set the user info from profile as-is (role/branch already correct from trend) and call onSuccess with the navigation url', async () => {
    getProfile.mockResolvedValue({
      result: {
        slug: 'user-1',
        role: { name: 'ADMIN', slug: 'admin', permissions: [] },
        branch: { slug: 'branch-1', name: 'Branch 1' },
      },
    })
    const onSuccess = vi.fn()

    const { result } = renderHook(() => useHandleAuthSuccess())
    await act(async () => {
      await result.current(tokens, { onSuccess })
    })

    expect(setToken).toHaveBeenCalledWith('access')
    expect(setRefreshToken).toHaveBeenCalledWith('refresh')
    expect(setUserInfo).toHaveBeenCalledWith({
      slug: 'user-1',
      role: { name: 'ADMIN', slug: 'admin', permissions: [] },
      branch: { slug: 'branch-1', name: 'Branch 1' },
    })
    expect(onSuccess).toHaveBeenCalledWith('/')
    expect(navigate).not.toHaveBeenCalled()

    // navigationUrl đã được "tiêu thụ" ở nhánh onSuccess — currentUrl phải
    // được dọn ngay tại đây, chứ không phải chỉ ở nhánh tự điều hướng, nếu
    // không currentUrl cũ (persist localStorage) sẽ còn sống tới lần đăng
    // nhập kế tiếp và ném khách về một trang không còn liên quan.
    expect(clearUrl).toHaveBeenCalled()
    expect(clearUrl.mock.invocationCallOrder[0]).toBeLessThan(
      onSuccess.mock.invocationCallOrder[0],
    )
  })

  it('should navigate itself when no onSuccess callback is given', async () => {
    getProfile.mockResolvedValue({
      result: { slug: 'user-1', role: { name: 'CUSTOMER' } },
    })

    const { result } = renderHook(() => useHandleAuthSuccess())
    await act(async () => {
      await result.current(tokens)
    })

    expect(clearUrl).toHaveBeenCalled()
  })

  it('should roll back the auth state and rethrow when the profile cannot be fetched', async () => {
    getProfile.mockResolvedValue(undefined)

    const { result } = renderHook(() => useHandleAuthSuccess())

    await expect(
      act(async () => {
        await result.current(tokens)
      }),
    ).rejects.toThrow()

    expect(setLogout).toHaveBeenCalled()
    expect(removeUserInfo).toHaveBeenCalled()
  })
})
