import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

/**
 * Hợp đồng của nguồn quyền phía giao diện.
 *
 * Hai thứ được khoá ở đây, vì mất cái nào cũng gây lỗi đã từng xảy ra thật:
 *
 * 1. Phải phân biệt "chưa lấy xong quyền" với "không có quyền nào". Gộp lại là
 *    lỗi tester ghi ngày 03/09/2026: mỗi lần F5 mọi vai trò khác khách hàng bị
 *    đá sang trang cấm.
 * 2. Phải có `staleTime`. `QueryClient` của dự án không đặt mặc định, nên thiếu
 *    nó thì mỗi lần điều hướng sang một trang được bảo vệ là một lời gọi
 *    `/auth/scope` mới.
 */
const { useQuery, getAuthScope, authState } = vi.hoisted(() => ({
  useQuery: vi.fn(),
  getAuthScope: vi.fn(),
  authState: { token: 'token-hop-le' as string | null },
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => useQuery(options),
}))
vi.mock('@/api', () => ({ getAuthScope }))
vi.mock('@/stores', () => ({ useAuthStore: () => authState }))
vi.mock('@/constants', () => ({ QUERYKEY: { authScope: 'auth-scope' } }))

import { usePermissionsStatus, usePermissions } from '@/hooks/use-permissions'

const mockQuery = (result: { data?: unknown; isFetched: boolean }) => {
  useQuery.mockReturnValue(result)
}

describe('usePermissionsStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.token = 'token-hop-le'
  })

  it('báo đang tải khi có token mà scope chưa về lần nào', () => {
    mockQuery({ data: undefined, isFetched: false })

    const { result } = renderHook(() => usePermissionsStatus())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.permissions).toEqual([])
  })

  it('báo đã xong khi scope về rỗng — đây là "không có quyền", không phải "chưa biết"', () => {
    mockQuery({ data: { result: { permissions: [] } }, isFetched: true })

    const { result } = renderHook(() => usePermissionsStatus())

    expect(result.current.isLoading).toBe(false)
    expect(result.current.permissions).toEqual([])
  })

  it('trả đúng danh sách quyền khi scope đã về', () => {
    mockQuery({
      data: { result: { permissions: ['CUSTOMER', 'ORDER'] } },
      isFetched: true,
    })

    const { result } = renderHook(() => usePermissionsStatus())

    expect(result.current.isLoading).toBe(false)
    expect(result.current.permissions).toEqual(['CUSTOMER', 'ORDER'])
  })

  it('không coi là đang tải khi chưa đăng nhập', () => {
    authState.token = null
    mockQuery({ data: undefined, isFetched: false })

    const { result } = renderHook(() => usePermissionsStatus())

    expect(result.current.isLoading).toBe(false)
  })

  it('chỉ gọi API khi đã có token, và có đặt staleTime', () => {
    mockQuery({ data: undefined, isFetched: false })

    renderHook(() => usePermissionsStatus())

    const options = useQuery.mock.calls[0][0]
    expect(options.enabled).toBe(true)
    expect(options.queryKey).toEqual(['auth-scope'])
    expect(options.staleTime).toBeGreaterThan(0)
    // Giữ trong bộ nhớ đệm lâu hơn ngưỡng cũ, để chuyển trang giữa phiên không
    // rơi về trạng thái chưa biết quyền.
    expect(options.gcTime).toBeGreaterThan(options.staleTime)
  })
})

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.token = 'token-hop-le'
  })

  it('giữ nguyên chữ ký cũ: trả thẳng mảng quyền', () => {
    mockQuery({ data: { result: { permissions: ['ORDER'] } }, isFetched: true })

    const { result } = renderHook(() => usePermissions())

    expect(result.current).toEqual(['ORDER'])
  })
})
