import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { AxiosError } from 'axios'

import {
  Button,
  Checkbox,
  CountdownTimer,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Label,
  OTPInput,
  PasswordInput,
} from '@/components/ui'
import { PasswordWithRulesInput } from '@/components/app/input'
import { login } from '@/api'
import { ButtonLoading } from '@/components/app/loading'
import { ChangePhoneConfirmDialog } from '@/components/app/dialog'
import {
  useCompleteRegister,
  useHandleAuthSuccess,
  useInitiateRegister,
  useResendRegisterOtp,
} from '@/hooks'
import { RESEND_COOLDOWN_MS, useRegisterFlowStore } from '@/stores'
import {
  useRegisterCredentialsSchema,
  TRegisterCredentialsSchema,
} from '@/schemas'
import { ROUTE } from '@/constants'
import { showErrorToast, showToast } from '@/utils'
import { IApiErrorResponse } from '@/types'

export const RegisterOtpPasswordForm = () => {
  const { t } = useTranslation(['auth'])
  const navigate = useNavigate()
  const {
    phonenumber,
    otpExpiresAt,
    resendAvailableAt,
    markOtpSent,
    clearRegisterFlow,
    setResendAvailableAt,
  } = useRegisterFlowStore()

  const [otpValue, setOtpValue] = useState('')
  const [otpError, setOtpError] = useState('')
  const [isExpired, setIsExpired] = useState(
    () => !!otpExpiresAt && new Date(otpExpiresAt).getTime() <= Date.now(),
  )
  const [isResendReady, setIsResendReady] = useState(
    () => !resendAvailableAt || new Date(resendAvailableAt).getTime() <= Date.now(),
  )
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isTermsAccepted, setIsTermsAccepted] = useState(false)
  const [isRecovering, setIsRecovering] = useState(false)

  const { mutate: completeRegister, isPending: isCompleting } =
    useCompleteRegister()
  const { mutate: resendOtp, isPending: isResending } = useResendRegisterOtp()
  const { mutate: initiateRegister, isPending: isInitiating } =
    useInitiateRegister()
  const handleAuthSuccess = useHandleAuthSuccess()

  const credentialsSchema = useRegisterCredentialsSchema()
  const form = useForm<TRegisterCredentialsSchema>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onChange',
  })

  // form.formState.isValid chỉ cập nhật sau một chu kỳ validate bất đồng bộ
  // của zodResolver, nên có độ trễ một nhịp so với giá trị hiển thị trên
  // input (vốn được cập nhật đồng bộ qua Controller). Dùng safeParse trực
  // tiếp trên giá trị đang theo dõi để nút "Tạo tài khoản" phản ứng ngay khi
  // người dùng gõ xong, tránh trạng thái khoá "trễ nhịp".
  const isCredentialsValid = credentialsSchema.safeParse(form.watch()).success

  const isAccountSectionVisible = otpValue.length === 6 && !isExpired

  const onOtpSent = (expiresAt: string) => {
    markOtpSent(expiresAt)
    setIsExpired(false)
    setIsResendReady(false)
    setOtpValue('')
    setOtpError('')
  }

  // Hết hạn thì token cũ không còn, backend trả 119047 nếu gọi resend.
  // Đường đúng lúc này là xin mã mới bằng initiate.
  const handleResend = () => {
    if (isExpired) {
      initiateRegister(
        { phonenumber },
        {
          onSuccess: (response) => {
            onOtpSent(response.result?.expiresAt ?? '')
            showToast('toast.registerOtpSent')
          },
          onError: (error) => handleOtpError(error),
        },
      )
      return
    }

    resendOtp(
      { phonenumber },
      {
        onSuccess: (response) => {
          onOtpSent(response.result?.expiresAt ?? '')
        },
        onError: (error) => handleOtpError(error),
      },
    )
  }

  const restartFlow = () => {
    clearRegisterFlow()
    navigate(ROUTE.REGISTER, { replace: true })
  }

  const handleOtpError = (error: unknown) => {
    const statusCode = (error as AxiosError<IApiErrorResponse>).response?.data
      ?.statusCode

    switch (statusCode) {
      case 119049:
        setOtpError(t('register.otpInvalid'))
        setOtpValue('')
        return
      case 119047:
      case 119048:
        setIsExpired(true)
        setOtpValue('')
        setOtpError(t('register.otpExpired'))
        return
      case 119050:
        showErrorToast(119050)
        // Server đã từ chối vì cooldown chưa hết; đặt lại mốc cooldown ở
        // client cho khớp 120s kể từ bây giờ, nếu không CountdownTimer mount
        // với resendAvailableAt cũ (đã ở quá khứ) sẽ lập tức báo hết hạn và
        // mở khoá nút ngay trong tick kế tiếp.
        setResendAvailableAt(new Date(Date.now() + RESEND_COOLDOWN_MS).toISOString())
        setIsResendReady(false)
        return
      case 119051:
        showErrorToast(119051)
        restartFlow()
        return
      case 119041:
        showErrorToast(119041)
        restartFlow()
        return
      default:
        if (statusCode) {
          showErrorToast(statusCode)
          return
        }
        showErrorToast((error as AxiosError).response?.status ?? 0)
    }
  }

  /**
   * 119041 ở bước tạo tài khoản KHÁC 119041 ở bước nhập số: gần như luôn nghĩa
   * là lời gọi trước đã tới server thành công nhưng response bị mất giữa đường,
   * nên tài khoản đã tồn tại và mật khẩu khách vừa đặt là đúng. Thử đăng nhập
   * ngầm để sửa im lặng, thay vì báo lỗi rồi ném họ về vạch xuất phát.
   *
   * Gọi thẳng hàm API chứ không qua useLogin: hook đó cố ý không tắt handler
   * lỗi toàn cục (màn đăng nhập cần nó), dùng ở đây sẽ ra hai toast chồng nhau.
   */
  const recoverExistingAccount = async (password: string) => {
    setIsRecovering(true)
    try {
      const response = await login({ phonenumber, password })
      await handleAuthSuccess(response.result, {
        onSuccess: () => {
          showToast('toast.registerSuccess')
          navigate(ROUTE.REGISTER_PROFILE, { replace: true })
          clearRegisterFlow()
        },
      })
    } catch {
      // Mật khẩu không khớp (số của người khác), hoặc lấy hồ sơ lỗi. Đích đến
      // đúng lúc này là trang đăng nhập, không phải quay lại bước nhập số:
      // khách cần đăng nhập chứ không cần đăng ký lại.
      clearRegisterFlow()
      showErrorToast(119041)
      navigate(ROUTE.LOGIN, { replace: true })
    } finally {
      setIsRecovering(false)
    }
  }

  const handleSubmit = (values: TRegisterCredentialsSchema) => {
    setOtpError('')
    completeRegister(
      {
        phonenumber,
        otp: otpValue.toUpperCase(),
        password: values.password,
      },
      {
        onSuccess: async (response) => {
          try {
            await handleAuthSuccess(response.result, {
              onSuccess: () => {
                showToast('toast.registerSuccess')
                // Không dùng navigationUrl: currentUrl là store persist, một giá
                // trị cũ từ lần nào đó bị chặn ở trang cần đăng nhập sẽ bị hiểu
                // nhầm thành "việc đang dở" và ném khách tới nơi họ không ngờ.
                navigate(ROUTE.REGISTER_PROFILE, { replace: true })
                // navigate trước, clearRegisterFlow sau: clearRegisterFlow
                // đặt phonenumber = '', và đó là dep trong effect guard của
                // register-otp.tsx — gọi trước navigate có thể khiến guard
                // đẩy về CLIENT_HOME nếu render kịp flush giữa hai lệnh.
                clearRegisterFlow()
              },
            })
          } catch {
            // Tài khoản đã được tạo trên server (OTP token đã isUsed) trước
            // khi bước này thất bại — không còn đường quay lại Step 2/1 nào
            // hợp lý. Dọn flow và đưa khách sang đăng nhập với thông báo
            // đúng ngữ cảnh, thay vì để họ thử lại và dính chuỗi lỗi mâu thuẫn.
            clearRegisterFlow()
            showToast('toast.registerAccountAlreadyCreated')
            navigate(ROUTE.LOGIN, { replace: true })
          }
        },
        onError: (error) => {
          const statusCode = (error as AxiosError<IApiErrorResponse>).response
            ?.data?.statusCode
          if (statusCode === 119041) {
            void recoverExistingAccount(values.password)
            return
          }
          handleOtpError(error)
        },
      },
    )
  }

  const isSubmitDisabled =
    !isAccountSectionVisible ||
    isCompleting ||
    isRecovering ||
    !isTermsAccepted ||
    !isCredentialsValid

  const resendLabel = useMemo(() => {
    if (isExpired) return t('register.sendNewCode')
    return t('register.resend')
  }, [isExpired, t])

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="space-y-2">
            <OTPInput
              length={6}
              allowText
              value={otpValue}
              onChange={(value) => {
                setOtpValue(value.toUpperCase())
                setOtpError('')
              }}
              disabled={isExpired}
            />
            {otpError && (
              <p className="text-sm text-center text-destructive">{otpError}</p>
            )}
          </div>

          <div className="flex justify-between items-center text-sm text-white">
            {isExpired ? (
              <span className="text-destructive">
                {t('register.otpExpired')}
              </span>
            ) : !otpExpiresAt ? (
              // Tới đây qua nhánh 119046: mã cũ còn sống nhưng không biết còn
              // bao lâu. Nói đúng những gì biết thay vì dựng một đồng hồ sai.
              <span className="text-white/75">
                {t('register.otpSentEarlier')}
              </span>
            ) : (
              // CountdownTimer tự render nhãn "hết hạn sau" của nó — không lặp
              // thêm register.otpExpiresIn ở đây kẻo hiện hai nhãn trùng nghĩa.
              <CountdownTimer
                expiresAt={otpExpiresAt}
                bufferMs={0}
                onExpired={() => setIsExpired(true)}
                // Nền là ảnh tối, phải ghi đè text-muted-foreground mặc định.
                className="text-primary"
              />
            )}

            <Button
              type="button"
              variant="link"
              className="px-0 text-primary"
              disabled={
                (!isResendReady && !isExpired) || isResending || isInitiating
              }
              onClick={handleResend}
            >
              {isResending || isInitiating ? (
                <ButtonLoading />
              ) : isResendReady || isExpired ? (
                resendLabel
              ) : (
                // Đếm ngược cooldown nằm ngay trong nhãn nút. Tách thành dòng
                // riêng thì màn hình có hai chỗ cùng nói một việc.
                <CountdownTimer
                  expiresAt={resendAvailableAt}
                  bufferMs={0}
                  onExpired={() => setIsResendReady(true)}
                  formatLabel={(time) => t('register.resendIn', { time })}
                  className="text-sm text-white/60"
                />
              )}
            </Button>
          </div>

          <div
            data-testid="register-password-section"
            data-visible={isAccountSectionVisible ? 'true' : 'false'}
            aria-hidden={!isAccountSectionVisible}
            className={`grid transition-all duration-300 ${
              isAccountSectionVisible
                ? 'grid-rows-[1fr] opacity-100'
                : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            {/* Khối này không unmount khi thu gọn (chủ ý — giữ mật khẩu đã nhập
                nếu OTP sai), nên chỉ ẩn thị giác không đủ: input vẫn tab-được.
                Disable khi thu gọn để đưa ra khỏi tab order. */}
            <div className="overflow-hidden space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">
                      {t('register.password')}
                    </FormLabel>
                    <FormControl>
                      <PasswordWithRulesInput
                        pendingRuleClassName="text-white/70"
                        inputClassName="text-white"
                        toggleClassName="text-white hover:text-white"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={t('register.enterPassword')}
                        disabled={!isAccountSectionVisible}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">
                      {t('register.confirmPassword')}
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        {...field}
                        placeholder={t('register.enterConfirmPassword')}
                        disabled={!isAccountSectionVisible}
                        className="text-white"
                        toggleClassName="text-white hover:text-white"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Chấp thuận điều khoản phải nằm trước lời gọi tạo tài khoản,
                  và tài khoản được tạo ngay ở màn này. Link mở tab mới để khách
                  không mất dữ liệu đang nhập. */}
              <div className="flex items-start space-x-2">
                <Checkbox
                  className="mt-0.5"
                  id="terms"
                  checked={isTermsAccepted}
                  onCheckedChange={(checked) =>
                    setIsTermsAccepted(checked as boolean)
                  }
                  disabled={!isAccountSectionVisible}
                />
                <Label htmlFor="terms" className="text-sm text-gray-300">
                  {t('register.policyCondition')}
                  <Link
                    to={ROUTE.POLICY}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {t('register.policy')}
                  </Link>
                  <span className="text-gray-300">{t('register.and')}</span>
                  <Link
                    to={ROUTE.SECURITY}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {t('register.securityTerm')}
                  </Link>
                  {t('register.ofTrendCoffee')}
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
              {isCompleting || isRecovering ? (
                <ButtonLoading />
              ) : (
                t('register.createAccount')
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-white"
              onClick={() =>
                otpValue.length > 0 ? setIsConfirmOpen(true) : restartFlow()
              }
            >
              {t('register.changePhone')}
            </Button>
          </div>
        </form>
      </Form>

      <ChangePhoneConfirmDialog
        isOpen={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        onConfirm={restartFlow}
      />
    </>
  )
}
