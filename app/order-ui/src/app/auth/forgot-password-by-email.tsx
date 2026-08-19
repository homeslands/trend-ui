import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, OTPInput } from '@/components/ui'
import { LoginBackground } from '@/assets/images'
import { cn } from '@/lib/utils'
import { useForgotPasswordStore } from '@/stores'
import { ForgotPasswordByEmailForm, ResetPasswordForm } from '@/components/app/form'
import { TForgotPasswordByEmailSchema, TResetPasswordSchema } from '@/schemas'
import { useConfirmForgotPassword, useInitiateForgotPassword, useVerifyOTPForgotPassword, useResendOTPForgotPassword } from '@/hooks'
import { showToast, showErrorToastMessage, showErrorToast } from '@/utils'
import { ROUTE, VerificationMethod } from '@/constants'
import { IApiErrorResponse } from '@/types'

const normalizeEmail = (email: string) => email.trim().toLowerCase()

export default function ForgotPasswordByEmail() {
    const { t } = useTranslation(['auth'])
    const { t: tToast } = useTranslation(['toast'])
    const navigate = useNavigate()
    const {
        setEmail,
        setStep,
        step,
        email,
        clearForgotPassword,
        setToken,
        token,
        setExpireTime,
        expireTime,
        setTokenExpireTime,
        tokenExpireTime,
        verificationMethod,
        setVerificationMethod,
    } = useForgotPasswordStore()
    const [otpValue, setOtpValue] = useState('')
    const [countdown, setCountdown] = useState(0)
    const [tokenCountdown, setTokenCountdown] = useState(0)
    const { mutate: initiateForgotPassword, isPending: isInitiating } = useInitiateForgotPassword()
    const { mutate: verifyOTPForgotPassword, isPending: isVerifying } = useVerifyOTPForgotPassword()
    const { mutate: confirmForgotPassword, isPending: isConfirming } = useConfirmForgotPassword()
    const { mutate: resendOTPForgotPassword, isPending: isResending } = useResendOTPForgotPassword()

    // Fix #2 (mirror): If user lands here but active flow was started via phone, redirect to phone page
    useEffect(() => {
        if (step >= 2 && verificationMethod === VerificationMethod.PHONE_NUMBER) {
            navigate(ROUTE.FORGOT_PASSWORD_BY_PHONE, { replace: true })
        }
    }, [step, verificationMethod, navigate])

    useEffect(() => {
        if (!expireTime || step !== 2) {
            setCountdown(0)
            return
        }

        const calculateTimeLeft = () => {
            const expireDate = new Date(expireTime).getTime()
            const now = new Date().getTime()
            const timeLeft = Math.floor((expireDate - now) / 1000)
            return Math.max(0, timeLeft)
        }

        setCountdown(calculateTimeLeft())

        const timer = setInterval(() => {
            const timeLeft = calculateTimeLeft()
            setCountdown(timeLeft)

            if (timeLeft <= 0) {
                clearInterval(timer)
            }
        }, 1000)

        return () => clearInterval(timer)
    }, [expireTime, step])

    useEffect(() => {
        if (!tokenExpireTime || step !== 3) {
            setTokenCountdown(0)
            return
        }

        const calculateTimeLeft = () => {
            const expireDate = new Date(tokenExpireTime).getTime()
            const now = new Date().getTime()
            const timeLeft = Math.floor((expireDate - now) / 1000)
            return Math.max(0, timeLeft)
        }

        setTokenCountdown(calculateTimeLeft())

        const timer = setInterval(() => {
            const timeLeft = calculateTimeLeft()
            setTokenCountdown(timeLeft)

            if (timeLeft <= 0) {
                clearInterval(timer)
            }
        }, 1000)

        return () => clearInterval(timer)
    }, [tokenExpireTime, step])

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    const getCountdownColor = () => {
        if (countdown > 60) return 'text-green-400'
        if (countdown > 0) return 'text-yellow-400'
        return 'text-red-400'
    }

    const handleSubmit = (value: TForgotPasswordByEmailSchema) => {
        const normalized = normalizeEmail(value.email)
        setEmail(normalized)
        // Lock method to email before advancing — avoids stale PHONE method triggering guard redirect
        setVerificationMethod(VerificationMethod.EMAIL)

        // Check if OTP is still valid for the same email (normalize before comparing)
        if (expireTime && normalizeEmail(email) === normalized) {
            const expireDate = new Date(expireTime).getTime()
            const now = new Date().getTime()
            const timeLeft = Math.floor((expireDate - now) / 1000)

            if (timeLeft > 0) {
                showToast(tToast('toast.otpStillValid'))
                setStep(2)
                return
            }
        }

        initiateForgotPassword({ email: normalized, verificationMethod: VerificationMethod.EMAIL }, {
            onSuccess: (response) => {
                showToast(tToast('toast.sendVerifyEmailSuccess'))
                setExpireTime(response?.result?.expiresAt || '')
                setStep(2)
            },
            onError: (error) => {
                const statusCode = (error as AxiosError<IApiErrorResponse>).response?.data?.statusCode
                if (statusCode === 119009) {
                    // Token already exists on BE — resume the existing OTP flow.
                    // Cross-device fallback: assume up to 10 min remaining (BE token TTL).
                    if (!expireTime || new Date(expireTime).getTime() < Date.now()) {
                        const fallback = new Date(Date.now() + 10 * 60 * 1000)
                        setExpireTime(fallback.toISOString())
                    }
                    showToast(tToast('toast.otpStillValid'))
                    setStep(2)
                } else if (statusCode) {
                    showErrorToast(statusCode)
                }
            }
        })
    }

    const handleVerifyOTP = () => {
        // BE stores OTP uppercase, ensure we send uppercase even if input had lowercase
        verifyOTPForgotPassword({ code: otpValue.toUpperCase() }, {
            onSuccess: (response) => {
                showToast(tToast('toast.verifyOTPSuccess'))
                setToken(response?.result?.token || '')

                const now = new Date()
                const expiresAt = new Date(now.getTime() + 5 * 60 * 1000)
                setTokenExpireTime(expiresAt.toISOString())

                setOtpValue('')

                setTimeout(() => {
                    setStep(3)
                }, 0)
            },
            onError: (error) => {
                const statusCode = (error as AxiosError<IApiErrorResponse>).response?.data?.statusCode
                // Global handler already shows toast. Reset local state so UI matches reality.
                if (statusCode === 119008 || statusCode === 119038) {
                    // Set expireTime to past so countdown=0 AND "Mã OTP đã hết hạn" text shows.
                    setExpireTime(new Date(0).toISOString())
                    setOtpValue('')
                }
            }
        })
    }

    const handleConfirmForgotPassword = (data: TResetPasswordSchema) => {
        if (tokenCountdown === 0) {
            showErrorToastMessage(tToast('toast.forgotPasswordTokenNotExists'))
            return
        }

        confirmForgotPassword({ newPassword: data.newPassword, token: data.token }, {
            onSuccess: () => {
                showToast(tToast('toast.confirmForgotPasswordSuccess'))
                clearForgotPassword()
                navigate(ROUTE.LOGIN)
            },
            onError: (error) => {
                const statusCode = (error as AxiosError<IApiErrorResponse>).response?.data?.statusCode
                if (statusCode === 119008 || statusCode === 119038) {
                    clearForgotPassword()
                    navigate(ROUTE.LOGIN)
                }
            }
        })
    }

    const handleResendOTP = () => {
        resendOTPForgotPassword({ email: email, verificationMethod: VerificationMethod.EMAIL }, {
            onSuccess: (response) => {
                showToast(tToast('toast.sendVerifyEmailSuccess'))
                setExpireTime(response?.result?.expiresAt || '')
                setOtpValue('')
            }
        })
    }

    const handleSendNewOTP = () => {
        // OTP expired — initiate a fresh token
        initiateForgotPassword({ email: email, verificationMethod: VerificationMethod.EMAIL }, {
            onSuccess: (response) => {
                showToast(tToast('toast.sendVerifyEmailSuccess'))
                setExpireTime(response?.result?.expiresAt || '')
                setOtpValue('')
            },
            onError: (error) => {
                const statusCode = (error as AxiosError<IApiErrorResponse>).response?.data?.statusCode
                if (statusCode === 119009) {
                    // BE still has a live token — fall back to 10 min so user has usable countdown
                    const fallback = new Date(Date.now() + 10 * 60 * 1000)
                    setExpireTime(fallback.toISOString())
                    setOtpValue('')
                    showToast(tToast('toast.otpStillValid'))
                } else if (statusCode) {
                    showErrorToast(statusCode)
                }
            }
        })
    }

    const handleBack = () => {
        if (step === 2) {
            setStep(1)
            setOtpValue('')
        }
    }

    const handleStartOver = () => {
        clearForgotPassword()
        navigate(ROUTE.FORGOT_PASSWORD)
    }

    return (
        <div className="flex relative justify-center items-center min-h-screen">
            <img src={LoginBackground} className="absolute top-0 left-0 w-full h-full sm:object-fill" />
            <div className="flex relative z-10 justify-center items-center w-full h-full">
                <Card className="sm:min-w-[24rem] bg-white border border-muted-foreground bg-opacity-10 mx-auto shadow-xl backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle className={cn('text-2xl text-center text-white')}>
                            {t('forgotPassword.title')}
                        </CardTitle>
                        <CardDescription className="text-center text-white">
                            {t('forgotPassword.useEmailDescription')}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {step === 1 && (
                            <ForgotPasswordByEmailForm onSubmit={handleSubmit} isLoading={isInitiating} defaultEmail={email} />
                        )}

                        {step === 2 && (
                            <div className="space-y-4">
                                <OTPInput
                                    value={otpValue}
                                    onChange={(val) => setOtpValue(val.toUpperCase())}
                                    length={6}
                                    className="justify-center"
                                    allowText={true}
                                    disabled={isVerifying}
                                />

                                {countdown > 0 && (
                                    <div className={cn('text-center text-sm', getCountdownColor())}>
                                        {t('forgotPassword.otpExpiresIn')}: {formatTime(countdown)}
                                    </div>
                                )}
                                {countdown === 0 && expireTime && (
                                    <div className="text-center text-red-400 text-sm">
                                        {t('forgotPassword.otpExpired')}
                                    </div>
                                )}

                                <Button
                                    disabled={countdown === 0 || otpValue.length < 6 || isVerifying}
                                    onClick={handleVerifyOTP}
                                    className="w-full"
                                >
                                    {isVerifying ? t('forgotPassword.verifying') : t('forgotPassword.verify')}
                                </Button>

                                <div className="flex flex-col gap-2">
                                    {countdown > 0 ? (
                                        <Button
                                            variant="outline"
                                            onClick={handleResendOTP}
                                            disabled={isResending || isInitiating || isVerifying}
                                            className="w-full border-white hover:bg-white hover:text-black"
                                        >
                                            {t('forgotPassword.resendOTP', { time: formatTime(countdown) })}
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            onClick={handleSendNewOTP}
                                            disabled={isInitiating || isResending}
                                            className="w-full border-white hover:bg-white hover:text-black"
                                        >
                                            {t('forgotPassword.sendNewOTP')}
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        onClick={handleBack}
                                        disabled={isVerifying || isInitiating || isResending}
                                        className="w-full text-white hover:bg-white/10 hover:text-white"
                                    >
                                        {t('forgotPassword.backButton')}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-4">
                                {tokenCountdown > 0 && (
                                    <div className="text-center text-primary text-sm">
                                        {t('forgotPassword.tokenExpiresIn')}: {formatTime(tokenCountdown)}
                                    </div>
                                )}
                                {tokenCountdown === 0 && tokenExpireTime && (
                                    <div className="text-center text-red-400 text-sm">
                                        {t('forgotPassword.tokenExpired')}
                                    </div>
                                )}

                                <ResetPasswordForm
                                    token={token}
                                    onSubmit={handleConfirmForgotPassword}
                                    isLoading={tokenCountdown === 0 || isConfirming}
                                />

                                {tokenCountdown === 0 && tokenExpireTime && (
                                    <Button
                                        variant="ghost"
                                        onClick={handleStartOver}
                                        className="w-full text-white hover:bg-white/10 hover:text-white"
                                    >
                                        {t('forgotPassword.startOver')}
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
