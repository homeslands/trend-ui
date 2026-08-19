import { useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { LoginBackground } from '@/assets/images'
import { RegisterPhoneForm } from '@/components/app/form'
import StepProgressBar from '@/app/auth/components/step-progress-bar'
import { ROUTE } from '@/constants'
import { useAuthStore, useRegisterFlowStore } from '@/stores'
import { useTheme } from '@/components/app/theme-provider'

export default function Register() {
  const { t } = useTranslation(['auth'])
  const { theme, setTheme } = useTheme()
  const { isAuthenticated } = useAuthStore()
  const { clearRegisterFlow } = useRegisterFlowStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (theme !== 'light') {
      setTheme('light')
    }
  }, [theme, setTheme])

  // Khách đã đăng nhập không có việc gì ở luồng đăng ký.
  useEffect(() => {
    if (isAuthenticated()) {
      navigate(ROUTE.CLIENT_HOME, { replace: true })
    }
  }, [isAuthenticated, navigate])

  // Vào bước 1 là bắt đầu lại: dọn luồng đang chạy để không còn số cũ treo lơ
  // lửng. Hồ sơ mã gửi gần nhất KHÔNG bị xoá, nên nhập lại đúng số đó vẫn khôi
  // phục được đồng hồ. Chỉ chạy lúc vào trang.
  useEffect(() => {
    clearRegisterFlow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hai bước: hồ sơ đã gộp vào bước xác thực nên tài khoản chỉ ra đời khi đã
  // có đủ thông tin.
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
            <StepProgressBar currentStep={1} steps={steps} />
            <CardTitle className="text-xl text-center text-white sm:text-2xl">
              {t('register.phoneTitle')}
            </CardTitle>
            <CardDescription className="text-center text-white/80">
              {t('register.phoneSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterPhoneForm />
          </CardContent>
          <CardFooter className="flex flex-col gap-2 text-sm text-white">
            <div className="flex gap-1">
              <span>{t('register.haveAccount')}</span>
              <NavLink to={ROUTE.LOGIN} className="text-primary">
                {t('register.login')}
              </NavLink>
            </div>
            <NavLink to={ROUTE.CLIENT_HOME} className="text-muted/70 hover:underline">
              {t('login.goBackToHome')}
            </NavLink>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
