import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const { navigate, setTheme, authState, flowState } = vi.hoisted(() => ({
  navigate: vi.fn(),
  setTheme: vi.fn(),
  authState: { isAuthenticated: vi.fn() },
  clearRegisterFlow: vi.fn(),
  flowState: { clearRegisterFlow: vi.fn(), otpExpiresAt: '' },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  NavLink: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))
vi.mock('@/stores', () => ({
  useAuthStore: () => authState,
  useRegisterFlowStore: () => flowState,
}))
vi.mock('@/components/app/theme-provider', () => ({
  useTheme: () => ({ theme: 'light', setTheme }),
}))
vi.mock('@/components/app/form', () => ({
  RegisterPhoneForm: () => <div data-testid="phone-form" />,
}))
vi.mock('@/assets/images', () => ({ LoginBackground: 'bg.png' }))

import Register from '@/app/auth/Register'
import { ROUTE } from '@/constants'

describe('Register page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.isAuthenticated = vi.fn().mockReturnValue(false)
    flowState.clearRegisterFlow = vi.fn()
    flowState.otpExpiresAt = ''
  })

  it('should send an already logged-in visitor home', () => {
    authState.isAuthenticated = vi.fn().mockReturnValue(true)

    render(<Register />)

    expect(navigate).toHaveBeenCalledWith(ROUTE.CLIENT_HOME, { replace: true })
  })

  it('should clear the running flow on entry', () => {
    // Chỉ dọn luồng đang chạy; hồ sơ mã gửi gần nhất do store giữ lại nên nhập
    // lại đúng số đó vẫn khôi phục được đồng hồ.
    render(<Register />)

    expect(flowState.clearRegisterFlow).toHaveBeenCalledTimes(1)
  })
})
