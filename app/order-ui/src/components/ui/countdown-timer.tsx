import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface CountdownTimerProps {
    expiresAt: string // ISO string timestamp when the timer expires
    onExpired?: () => void
    className?: string
    /**
     * Biên an toàn trừ vào thời gian còn lại, bù cho độ trễ mạng.
     * Mặc định 30s để giữ nguyên hành vi của các dialog xác thực SĐT/email.
     * Luồng đăng ký truyền 0 vì đã đọc expiresAt trực tiếp từ server.
     */
    bufferMs?: number
    /**
     * Tuỳ chọn: tự dựng phần chữ hiển thị từ chuỗi "m:ss" đã format, thay cho
     * nhãn mặc định "{t('profile.otpExpiredIn')}: m:ss". Dùng khi timer này
     * đếm ngược cho một mốc thời gian khác với "OTP hết hạn" (vd. cooldown
     * gửi lại) và nhãn mặc định sẽ nói sai ngữ cảnh.
     * Không truyền thì giữ nguyên hành vi cũ — hai dialog xác thực SĐT/email
     * không cần đổi gì.
     */
    formatLabel?: (time: string) => React.ReactNode
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
    expiresAt,
    onExpired,
    className,
    bufferMs = 30000,
    formatLabel,
}) => {
    const { t } = useTranslation(['profile'])
    const [timeLeft, setTimeLeft] = useState(0)

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = Date.now()
            const expiresAtMs = new Date(expiresAt).getTime()
            const remaining = Math.max(0, expiresAtMs - now)

            // Subtract the buffer to account for network delays
            const bufferedRemaining = Math.max(0, remaining - bufferMs)
            return bufferedRemaining
        }

        const updateTimer = () => {
            const remaining = calculateTimeLeft()
            setTimeLeft(remaining)

            if (remaining === 0 && onExpired) {
                onExpired()
            }
        }

        // Initial calculation
        updateTimer()

        // Update every second
        const interval = setInterval(updateTimer, 1000)

        return () => clearInterval(interval)
    }, [expiresAt, onExpired, bufferMs])

    const formatTime = (milliseconds: number) => {
        const totalSeconds = Math.floor(milliseconds / 1000)
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60

        return {
            minutes,
            seconds: seconds.toString().padStart(2, '0')
        }
    }

    const { minutes, seconds } = formatTime(timeLeft)
    const time = `${minutes}:${seconds}`

    if (timeLeft === 0) {
        return null
    }

    return (
        <div className={cn('text-sm text-center text-primary', className)}>
            {formatLabel ? formatLabel(time) : `${t('profile.otpExpiredIn')}: ${time}`}
        </div>
    )
}

CountdownTimer.displayName = 'CountdownTimer' 