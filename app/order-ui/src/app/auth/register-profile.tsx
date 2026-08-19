import { useEffect } from 'react'
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
import { RegisterProfileForm } from '@/components/app/form'
import StepProgressBar from '@/app/auth/components/step-progress-bar'
import { ROUTE } from '@/constants'
import { useAuthStore } from '@/stores'
import { useTheme } from '@/components/app/theme-provider'

export default function RegisterProfile() {
  const { t } = useTranslation(['auth'])
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (theme !== 'light') {
      setTheme('light')
    }
  }, [theme, setTheme])

  // Bước này chỉ dành cho người đã đăng nhập xong ở Step 2.
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate(ROUTE.LOGIN, { replace: true })
    }
  }, [isAuthenticated, navigate])

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
            <StepProgressBar currentStep={3} steps={steps} />
            <CardTitle className="text-xl text-center text-white sm:text-2xl">
              {t('register.profileTitle')}
            </CardTitle>
            <CardDescription className="text-center text-white/80">
              {t('register.profileSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterProfileForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
