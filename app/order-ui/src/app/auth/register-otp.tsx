import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { LoginBackground } from '@/assets/images'
import { RegisterOtpPasswordForm } from '@/components/app/form'
import StepProgressBar from '@/app/auth/components/step-progress-bar'
import { ROUTE } from '@/constants'
import { useAuthStore, useRegisterFlowStore } from '@/stores'
import { useTheme } from '@/components/app/theme-provider'

export default function RegisterOtp() {
  const { t } = useTranslation(['auth'])
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { phonenumber } = useRegisterFlowStore()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (theme !== 'light') {
      setTheme('light')
    }
  }, [theme, setTheme])

  // Đã đăng nhập thì không còn việc ở đây; chưa qua Step 1 thì không có số để xác thực.
  //
  // Chỉ kiểm tra MỘT LẦN lúc vào trang, không phải bất biến chạy suốt vòng đời:
  // ngay sau khi tạo tài khoản thành công, khách vừa đăng nhập xong và store
  // đăng ký bị dọn (phonenumber = ''), nên một guard chạy lại sẽ thấy
  // "đã đăng nhập" rồi đá về trang chủ, nuốt mất bước hồ sơ vừa điều hướng tới.
  const hasCheckedEntry = useRef(false)
  useEffect(() => {
    if (hasCheckedEntry.current) return
    hasCheckedEntry.current = true

    if (isAuthenticated()) {
      navigate(ROUTE.CLIENT_HOME, { replace: true })
      return
    }
    if (!phonenumber) {
      navigate(ROUTE.REGISTER, { replace: true })
    }
  }, [isAuthenticated, phonenumber, navigate])

  if (!phonenumber) return null

  const steps = [
    t('register.stepPhone'),
    t('register.stepVerify'),
    t('register.stepProfile'),
  ]

  return (
    <div className="flex relative justify-center items-center min-h-screen">
      <img
        src={LoginBackground}
        className="object-cover absolute top-0 left-0 w-full h-full sm:object-fill"
      />
      <div className="flex relative z-10 justify-center items-center p-4 w-full">
        <Card className="overflow-y-auto custom-scroll custom-scroll-on-dark w-full max-w-md max-h-[calc(100dvh-2rem)] border border-muted-foreground bg-white bg-opacity-10 shadow-xl backdrop-blur-xl">
          <CardHeader>
            <StepProgressBar currentStep={2} steps={steps} />
            <CardTitle className="text-xl text-center text-white sm:text-2xl">
              {t('register.otpTitle')}
            </CardTitle>
            <CardDescription className="text-center text-white/80">
              {t('register.otpSentTo', { phone: phonenumber })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterOtpPasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
