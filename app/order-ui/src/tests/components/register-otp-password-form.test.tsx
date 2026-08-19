import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const completeMutate = vi.fn()
const resendMutate = vi.fn()
const initiateMutate = vi.fn()
const clearRegisterFlow = vi.fn()
const markOtpSent = vi.fn()
const handleAuthSuccess = vi.fn()
const navigate = vi.fn()
// vi.mock('@/utils', ...) references these directly in its returned object
// (not nested inside an unlaunched function like the other mocks below), so
// the factory evaluates them eagerly when hoisted above the const
// declarations — vi.hoisted() is required here to avoid a TDZ error.
const { showToast, showErrorToast, login } = vi.hoisted(() => ({
  showToast: vi.fn(),
  showErrorToast: vi.fn(),
  login: vi.fn(),
}))
// Không dùng vi.fn() trần: cần mock thật sự cập nhật storeState để component
// đọc lại resendAvailableAt mới ở lần render kế tiếp (giống hành vi thật của
// zustand), thay vì chỉ ghi nhận lời gọi.
const setResendAvailableAt = vi.fn((value: string) => {
  storeState = { ...storeState, resendAvailableAt: value }
})

let storeState = {
  phonenumber: '0376295216',
  // OTP còn hạn
  otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  // cooldown gửi lại đã hết
  resendAvailableAt: new Date(Date.now() - 1000).toISOString(),
  clearRegisterFlow,
  markOtpSent,
  setResendAvailableAt,
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/hooks', () => ({
  useCompleteRegister: () => ({ mutate: completeMutate, isPending: false }),
  useResendRegisterOtp: () => ({ mutate: resendMutate, isPending: false }),
  useInitiateRegister: () => ({ mutate: initiateMutate, isPending: false }),
  useHandleAuthSuccess: () => handleAuthSuccess,
}))
vi.mock('@/stores', () => ({
  useRegisterFlowStore: () => storeState,
  RESEND_COOLDOWN_MS: 2 * 60 * 1000,
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))
vi.mock('@/api', () => ({
  login: (params: { phonenumber: string; password: string }) => login(params),
}))
vi.mock('@/components/app/picker', () => ({
  DatePicker: ({ onSelect }: { onSelect: (v: string) => void }) => (
    <button type="button" onClick={() => onSelect('01/01/1990')}>
      date-picker
    </button>
  ),
}))
vi.mock('@/utils', () => ({
  showToast,
  showErrorToast,
}))

import { RegisterOtpPasswordForm } from '@/components/app/form'
import { ROUTE } from '@/constants'


const fillPassword = async () => {
  await userEvent.type(
    screen.getByPlaceholderText('register.enterPassword'),
    'matkhau1',
  )
  await userEvent.type(
    screen.getByPlaceholderText('register.enterConfirmPassword'),
    'matkhau1',
  )
}

const typeOtp = async (value: string) => {
  const boxes = screen.getAllByRole('textbox')
  for (let i = 0; i < value.length; i += 1) {
    await userEvent.type(boxes[i], value[i])
  }
}

describe('RegisterOtpPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState = {
      ...storeState,
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      resendAvailableAt: new Date(Date.now() - 1000).toISOString(),
    }
  })

  it('should keep the password section hidden until 6 characters are entered', async () => {
    render(<RegisterOtpPasswordForm />)

    expect(screen.getByTestId('register-password-section')).toHaveAttribute(
      'data-visible',
      'false',
    )

    await typeOtp('A1B2C3')

    expect(screen.getByTestId('register-password-section')).toHaveAttribute(
      'data-visible',
      'true',
    )
  })

  it('should call resend when the OTP is still valid', async () => {
    render(<RegisterOtpPasswordForm />)

    await userEvent.click(screen.getByRole('button', { name: /resend/i }))

    expect(resendMutate).toHaveBeenCalled()
    expect(initiateMutate).not.toHaveBeenCalled()
  })

  it('should not fake a countdown when the previous code timing is unknown', async () => {
    // Nhánh 119046: backend không trả expiresAt nên store để trống hai mốc.
    storeState = { ...storeState, otpExpiresAt: '', resendAvailableAt: '' }
    render(<RegisterOtpPasswordForm />)

    expect(screen.getByText('register.otpSentEarlier')).toBeInTheDocument()
    // Không khoá nút gửi lại bằng một cooldown tự bịa; server chặn bằng 119050.
    expect(screen.getByRole('button', { name: /resend/i })).toBeEnabled()
  })

  it('should call initiate instead of resend once the OTP has expired', async () => {
    storeState = {
      ...storeState,
      otpExpiresAt: new Date(Date.now() - 1000).toISOString(),
    }
    render(<RegisterOtpPasswordForm />)

    await userEvent.click(screen.getByRole('button', { name: /sendNewCode/i }))

    expect(initiateMutate).toHaveBeenCalled()
    expect(resendMutate).not.toHaveBeenCalled()
  })

  it('should keep the submit button disabled until the terms are accepted', async () => {
    render(<RegisterOtpPasswordForm />)

    await typeOtp('A1B2C3')
    await fillPassword()

    expect(
      screen.getByRole('button', { name: /createAccount/i }),
    ).toBeDisabled()
  })

  it('should send the OTP uppercased together with the password', async () => {
    render(<RegisterOtpPasswordForm />)

    await typeOtp('a1b2c3')
    await fillPassword()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(
      screen.getByRole('button', { name: /createAccount/i }),
    )

    expect(completeMutate).toHaveBeenCalledWith(
      {
        phonenumber: '0376295216',
        otp: 'A1B2C3',
        password: 'matkhau1',
      },
      expect.any(Object),
    )
  })

  it('should reset the resend cooldown and keep the button disabled after a 119050 (resend too soon) error', async () => {
    render(<RegisterOtpPasswordForm />)

    await userEvent.click(screen.getByRole('button', { name: /resend/i }))

    const onError = resendMutate.mock.calls[0][1].onError
    act(() => {
      onError({ response: { data: { statusCode: 119050 } } })
    })

    // Server đã từ chối vì cooldown chưa hết — mốc cooldown ở client phải
    // được đẩy lại về tương lai, chứ không phải chỉ đặt cờ cục bộ, nếu
    // không CountdownTimer sẽ mount với một mốc đã ở quá khứ và tự báo hết
    // hạn ngay trong tick kế tiếp, mở khoá nút sai.
    expect(setResendAvailableAt).toHaveBeenCalledTimes(1)
    const newResendAvailableAt = setResendAvailableAt.mock.calls[0][0]
    expect(new Date(newResendAvailableAt).getTime()).toBeGreaterThan(
      Date.now(),
    )

    expect(screen.getByRole('button', { name: /resend/i })).toBeDisabled()
  })

  const submitPasswordStep = async () => {
    render(<RegisterOtpPasswordForm />)

    await typeOtp('a1b2c3')
    await fillPassword()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(
      screen.getByRole('button', { name: /createAccount/i }),
    )

    return completeMutate.mock.calls[0][1].onSuccess as (response: {
      result: unknown
    }) => Promise<void>
  }

  it('should navigate to the profile step and clear the flow, in that order', async () => {
    handleAuthSuccess.mockImplementation(async (_result, options) => {
      options.onSuccess(ROUTE.HOME)
    })

    const onSuccess = await submitPasswordStep()
    await act(async () => {
      await onSuccess({ result: {} })
    })

    expect(navigate).toHaveBeenCalledWith(ROUTE.REGISTER_PROFILE, {
      replace: true,
    })
    expect(clearRegisterFlow).toHaveBeenCalled()
    // clearRegisterFlow đặt phonenumber = '', một dep trong effect guard của
    // register-otp.tsx — phải điều hướng xong trước khi gọi nó, kẻo guard
    // đẩy về CLIENT_HOME nếu render kịp flush giữa hai lệnh.
    expect(navigate.mock.invocationCallOrder[0]).toBeLessThan(
      clearRegisterFlow.mock.invocationCallOrder[0],
    )
  })

  it('should go to the profile step even when a stale pending url exists', async () => {
    handleAuthSuccess.mockImplementation(async (_result, options) => {
      options.onSuccess('/some-checkout-in-progress')
    })

    const onSuccess = await submitPasswordStep()
    await act(async () => {
      await onSuccess({ result: {} })
    })

    // currentUrl là store persist: một giá trị cũ từ lần bị chặn ở trang cần
    // đăng nhập không được phép lái khách đi đâu khác ở cuối luồng đăng ký.
    expect(navigate).toHaveBeenCalledWith(ROUTE.REGISTER_PROFILE, {
      replace: true,
    })
    expect(navigate).not.toHaveBeenCalledWith(
      '/some-checkout-in-progress',
      expect.anything(),
    )
  })

  it('should send the customer to login with an explanatory toast when the account was created but post-auth setup failed', async () => {
    handleAuthSuccess.mockRejectedValue(new Error('failed to fetch profile'))

    const onSuccess = await submitPasswordStep()
    await act(async () => {
      await onSuccess({ result: {} })
    })

    // Tại thời điểm này tài khoản đã tồn tại trên server (OTP token đã
    // isUsed) — không còn đường quay lại Step 2/1 hợp lý nào, nên phải dọn
    // flow và đưa khách sang đăng nhập với thông báo đúng ngữ cảnh.
    expect(clearRegisterFlow).toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith('toast.registerAccountAlreadyCreated')
    expect(navigate).toHaveBeenCalledWith(ROUTE.LOGIN, { replace: true })
    expect(showErrorToast).not.toHaveBeenCalled()
  })

  describe('when the account already exists at the create step (119041)', () => {
    const submitAndFail119041 = async () => {
      render(<RegisterOtpPasswordForm />)

      await typeOtp('a1b2c3')
      await fillPassword()
          await userEvent.click(screen.getByRole('checkbox'))
      await userEvent.click(
        screen.getByRole('button', { name: /createAccount/i }),
      )

      const onError = completeMutate.mock.calls[0][1].onError
      await act(async () => {
        onError({ response: { data: { statusCode: 119041 } } })
        // để promise của lần đăng nhập ngầm chạy xong
        await Promise.resolve()
        await Promise.resolve()
      })
    }

    it('should silently log the customer in — the lost response means the account is theirs', async () => {
      login.mockResolvedValue({ result: { accessToken: 'access' } })
      handleAuthSuccess.mockImplementation(async (_result, options) => {
        options.onSuccess(ROUTE.HOME)
      })

      await submitAndFail119041()

      expect(login).toHaveBeenCalledWith({
        phonenumber: '0376295216',
        password: 'matkhau1',
      })
      // Tài khoản do lần gọi trước tạo ra cũng chưa có hồ sơ, nên vẫn phải đi
      // tiếp sang bước điền tên và ngày sinh.
      expect(navigate).toHaveBeenCalledWith(ROUTE.REGISTER_PROFILE, {
        replace: true,
      })
      expect(showToast).toHaveBeenCalledWith('toast.registerSuccess')
      expect(clearRegisterFlow).toHaveBeenCalled()
    })

    it('should send the customer to login when the password does not match — the number is someone else\'s', async () => {
      login.mockRejectedValue(new Error('invalid credentials'))

      await submitAndFail119041()

      expect(showErrorToast).toHaveBeenCalledWith(119041)
      expect(navigate).toHaveBeenCalledWith(ROUTE.LOGIN, { replace: true })
      expect(navigate).not.toHaveBeenCalledWith(
        ROUTE.REGISTER,
        expect.anything(),
      )
    })
  })
})
