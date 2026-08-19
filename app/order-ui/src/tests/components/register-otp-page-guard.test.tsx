import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const { navigate, setTheme, authState, flowState } = vi.hoisted(() => ({
  navigate: vi.fn(),
  setTheme: vi.fn(),
  authState: { isAuthenticated: vi.fn() },
  flowState: { phonenumber: '' },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}))
vi.mock('@/stores', () => ({
  useAuthStore: () => authState,
  useRegisterFlowStore: () => flowState,
}))
vi.mock('@/components/app/theme-provider', () => ({
  useTheme: () => ({ theme: 'light', setTheme }),
}))
vi.mock('@/components/app/form', () => ({
  RegisterOtpPasswordForm: () => <div data-testid="otp-form" />,
}))
vi.mock('@/assets/images', () => ({ LoginBackground: 'bg.png' }))

import RegisterOtp from '@/app/auth/register-otp'
import { ROUTE } from '@/constants'

describe('RegisterOtp page guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.isAuthenticated = vi.fn().mockReturnValue(false)
    flowState.phonenumber = '0376295216'
  })

  it('should send an already logged-in visitor home', () => {
    authState.isAuthenticated = vi.fn().mockReturnValue(true)

    render(<RegisterOtp />)

    expect(navigate).toHaveBeenCalledWith(ROUTE.CLIENT_HOME, { replace: true })
  })

  it('should send a visitor with no phone number back to step 1', () => {
    flowState.phonenumber = ''

    render(<RegisterOtp />)

    expect(navigate).toHaveBeenCalledWith(ROUTE.REGISTER, { replace: true })
  })

  it('should let a visitor mid-flow stay', () => {
    render(<RegisterOtp />)

    expect(navigate).not.toHaveBeenCalled()
  })

  it('should not bounce home once the account has just been created', () => {
    const { rerender } = render(<RegisterOtp />)
    expect(navigate).not.toHaveBeenCalled()

    // Tạo tài khoản xong: khách vừa đăng nhập và store đăng ký bị dọn. Guard chỉ
    // là kiểm tra lúc vào trang, chạy lại ở đây sẽ nuốt mất điều hướng sang
    // bước hồ sơ mà form vừa thực hiện.
    authState.isAuthenticated = vi.fn().mockReturnValue(true)
    flowState.phonenumber = ''
    rerender(<RegisterOtp />)

    expect(navigate).not.toHaveBeenCalled()
  })
})
