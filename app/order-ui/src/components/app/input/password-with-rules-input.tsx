import { useEffect, useState } from 'react'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { Input, Button } from '@/components/ui'
import { AuthRules } from '@/constants'

interface PasswordWithRulesProps {
    value?: string | null | undefined
    onChange: (value: string) => void
    placeholder?: string
    disabled?: boolean
    /**
     * Màu cho luật CHƯA đạt. Mặc định `text-muted-foreground` hợp với nền sáng;
     * các màn auth đặt trên ảnh tối phải truyền màu sáng hơn kẻo chữ chìm vào nền.
     * Luật đã đạt luôn giữ màu xanh, không bị prop này ghi đè.
     */
    pendingRuleClassName?: string
    /** Màu chữ trong ô nhập — dấu chấm mật khẩu thừa hưởng màu chữ của thẻ cha. */
    inputClassName?: string
    /** Màu nút hiện/ẩn mật khẩu, cùng lý do như inputClassName. */
    toggleClassName?: string
}

export default function PasswordWithRulesInput({
    value,
    onChange,
    placeholder,
    disabled,
    pendingRuleClassName = 'text-muted-foreground',
    inputClassName,
    toggleClassName,
}: PasswordWithRulesProps) {
    const { t } = useTranslation('auth')

    const [showPassword, setShowPassword] = useState(false)
    const [touched, setTouched] = useState(false)

    const [rules, setRules] = useState({
        minLength: false,
        hasLetter: false,
        hasNumber: false,
    })

    const hasInput = value && value.length > 0

    useEffect(() => {
        if (!hasInput) {
            setRules({ minLength: false, hasLetter: false, hasNumber: false })
            return
        }

        setRules({
            minLength: value.length >= AuthRules.MIN_LENGTH,
            hasLetter: /[A-Za-z]/.test(value),
            hasNumber: /\d/.test(value),
        })
    }, [value, hasInput])

    // Comment lại strength evaluation vì chỉ còn 1 rule (minLength)
    // const strength = (() => {
    //     const passed = Object.values(rules).filter(Boolean).length
    //     if (!hasInput) return null
    //     if (passed <= 1) return t('rule.weak')
    //     if (passed === 2 || passed === 3) return t('rule.medium')
    //     return t('rule.strong')
    // })()

    return (
        <div className="space-y-2">
            <div className="relative">
                <Input
                    type={showPassword ? 'text' : 'password'}
                    className={cn('pr-10 hide-password-toggle', inputClassName)}
                    value={value || ''}
                    onChange={(e) => {
                        onChange(e.target.value)
                        if (!touched) setTouched(true)
                    }}
                    onBlur={() => setTouched(true)}
                    placeholder={placeholder}
                    disabled={disabled}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn('absolute top-0 right-0 px-3 py-2 h-full hover:bg-transparent', toggleClassName)}
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={disabled}
                >
                    {showPassword && !disabled ? (
                        <EyeIcon className="w-4 h-4" />
                    ) : (
                        <EyeOffIcon className="w-4 h-4" />
                    )}
                    <span className="sr-only">
                        {showPassword ? t('register.hidePassword') : t('register.showPassword')}
                    </span>
                </Button>

                <style>{`
          .hide-password-toggle::-ms-reveal,
          .hide-password-toggle::-ms-clear {
            display: none;
            pointer-events: none;
            visibility: hidden;
          }
        `}</style>
            </div>

            {touched && (
                <div className="space-y-1 text-sm">
                    <ul className="space-y-1">
                        <li className={cn(rules.minLength ? 'text-green-600' : pendingRuleClassName)}>
                            • {t('rule.minLength', { count: AuthRules.MIN_LENGTH })}
                        </li>
                        <li className={cn(rules.hasLetter ? 'text-green-600' : pendingRuleClassName)}>
                            • {t('rule.hasLetter')}
                        </li>
                        <li className={cn(rules.hasNumber ? 'text-green-600' : pendingRuleClassName)}>
                            • {t('rule.hasNumber')}
                        </li>
                    </ul>

                    {/* Comment lại strength evaluation vì chỉ còn 1 rule */}
                    {/* {strength && (
                        <div className={cn(
                            'text-xs font-medium mt-1',
                            strength === t('rule.weak') && 'text-red-600',
                            strength === t('rule.medium') && 'text-yellow-600',
                            strength === t('rule.strong') && 'text-green-600'
                        )}>
                            {t('rule.strength')}: {strength}
                        </div>
                    )} */}
                </div>
            )}
        </div>
    )
}
