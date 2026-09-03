import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

/**
 * Hồi quy cho lỗi tester ghi ngày 03/09/2026
 * (`tests/tester-issues/1.3.9.xlsx`, dòng 45):
 * *"admin, staff, … (trừ customer) mỗi lần load lại => f5 => 403"*.
 *
 * Nguyên nhân: sau mỗi lần tải lại trang, cache của react-query rỗng nên
 * `usePermissions()` trả `[]` trong khoảnh khắc đầu tiên. `ProtectedElement`
 * hiểu mảng rỗng là "không có quyền nào" và đá người dùng sang trang cấm, dù
 * lời gọi `/auth/scope` còn chưa trả về. Khách hàng không dính vì nhánh kiểm
 * tra của họ nằm trước, không đọc tới permissions.
 */
const { navigate, authState, userState, permissionsState, safeNavigate } =
  vi.hoisted(() => ({
    navigate: vi.fn(),
    safeNavigate: vi.fn(),
    authState: {
      isAuthenticated: vi.fn(),
      setLogout: vi.fn(),
      token: 'token-hop-le',
      isRefreshing: false,
    },
    userState: {
      userInfo: { role: { name: 'ADMIN' } } as { role: { name: string } } | null,
      removeUserInfo: vi.fn(),
    },
    permissionsState: { permissions: [] as string[], isLoading: true },
  }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: '/system/staff' }),
}))
vi.mock('@/stores', () => ({
  useAuthStore: () => authState,
  useUserStore: () => userState,
  useCartItemStore: () => ({ clearCart: vi.fn() }),
  useCurrentUrlStore: () => ({
    setCurrentUrl: vi.fn(),
    shouldUpdateUrl: () => false,
  }),
}))
vi.mock('@/hooks', () => ({
  usePermissionsStatus: () => permissionsState,
}))
vi.mock('@/utils', () => ({
  showToast: vi.fn(),
  isAuthLoading: () => false,
  isValidRedirectUrl: () => true,
  safeNavigate: (...args: unknown[]) => safeNavigate(...args),
}))
vi.mock('@/router/routes', () => ({
  sidebarRoutes: [{ path: '/system/staff', permission: 'CUSTOMER' }],
}))

import ProtectedElement from '@/components/app/elements/protected-element'
import { ROUTE } from '@/constants'

const renderGuard = () =>
  render(<ProtectedElement element={<div data-testid="noi-dung" />} />)

describe('ProtectedElement — quyền chưa tải xong', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.isAuthenticated = vi.fn().mockReturnValue(true)
    authState.token = 'token-hop-le'
    authState.isRefreshing = false
    userState.userInfo = { role: { name: 'ADMIN' } }
    permissionsState.permissions = []
    permissionsState.isLoading = true
  })

  it('không đá sang trang cấm khi scope chưa lấy xong', () => {
    renderGuard()

    expect(safeNavigate).not.toHaveBeenCalled()
  })

  it('không render nội dung trang trước khi biết quyền', () => {
    const { queryByTestId } = renderGuard()

    expect(queryByTestId('noi-dung')).toBeNull()
  })

  it('cho vào khi scope đã về và có đúng quyền của route', () => {
    permissionsState.isLoading = false
    permissionsState.permissions = ['CUSTOMER']

    const { queryByTestId } = renderGuard()

    expect(safeNavigate).not.toHaveBeenCalled()
    expect(queryByTestId('noi-dung')).not.toBeNull()
  })

  it('vẫn chặn khi scope đã về mà thật sự không có quyền nào', () => {
    permissionsState.isLoading = false
    permissionsState.permissions = []

    renderGuard()

    expect(safeNavigate).toHaveBeenCalledWith(
      navigate,
      ROUTE.FORBIDDEN,
      '/system/staff',
    )
  })

  it('khách hàng không phụ thuộc scope, không bị chặn nhầm', () => {
    userState.userInfo = { role: { name: 'CUSTOMER' } }
    permissionsState.isLoading = true
    permissionsState.permissions = []

    renderGuard()

    // Khách hàng vào /system thì bị chặn, nhưng vì đúng vai trò chứ không phải
    // vì thiếu scope — nhánh 3 trả về trước khi đọc tới permissions.
    expect(safeNavigate).toHaveBeenCalledWith(
      navigate,
      ROUTE.FORBIDDEN,
      '/system/staff',
    )
  })
})
