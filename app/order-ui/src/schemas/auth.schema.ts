import * as z from 'zod'
import { useTranslation } from 'react-i18next'

import {
  AuthRules,
  NAME_REGEX,
  // PASSWORD_REGEX,
  PHONE_NUMBER_REGEX,
  VN_MOBILE_PHONE_REGEX,
} from '@/constants'
import moment from 'moment'

export const loginSchema = z.object({
  phonenumber: z.string(),
  password: z.string(),
})

export function useRegisterPhoneSchema() {
  const { t } = useTranslation('auth')
  return z.object({
    phonenumber: z
      .string()
      .min(1, t('register.phoneNumberRequired'))
      .length(10, t('register.phoneNumberMaxLength'))
      .regex(VN_MOBILE_PHONE_REGEX, t('register.phoneNumberInvalid')),
  })
}

type Translate = ReturnType<typeof useTranslation>['t']

// Hai nhóm trường của bước 2, khai báo một lần rồi dùng lại cho cả schema từng
// panel lẫn schema đầy đủ lúc gửi — không nhân đôi luật ở ba chỗ.
const passwordFields = (t: Translate) => ({
  password: z
    .string()
    .min(AuthRules.MIN_LENGTH, {
      message: t('register.minLength', { count: AuthRules.MIN_LENGTH }),
    })
    .refine((val) => /[A-Za-z]/.test(val), {
      message: t('register.hasLetter'),
    })
    .refine((val) => /\d/.test(val), {
      message: t('register.hasNumber'),
    }),
  confirmPassword: z.string().min(1, t('register.confirmPasswordRequired')),
})

const profileFields = (t: Translate) => {
  const requiredName = (required: string, tooLong: string, invalid: string) =>
    z
      .string()
      .trim()
      .min(1, required)
      .max(100, tooLong)
      .regex(NAME_REGEX, invalid)

  return {
    firstName: requiredName(
      t('register.firstNameRequired'),
      t('register.firstNameTooLong', { count: 100 }),
      t('register.firstNameInvalid'),
    ),
    lastName: requiredName(
      t('register.lastNameRequired'),
      t('register.lastNameTooLong', { count: 100 }),
      t('register.lastNameInvalid'),
    ),
    // DatePicker phát ra null khi khách bỏ chọn ngày, nên vẫn phải nhận null —
    // nhưng quy về chuỗi rỗng để báo "bắt buộc" bằng i18n thay vì thông báo
    // mặc định tiếng Anh của zod.
    dob: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v?.trim() ?? '')
      .refine((val) => val !== '', { message: t('register.dobRequired') })
      .refine(
        (val) =>
          val === '' ||
          moment(val, 'DD/MM/YYYY', true).isSameOrBefore(moment(), 'day'),
        { message: t('register.dobInvalid') },
      ),
  }
}

/** Panel đầu của bước 2: mật khẩu và xác nhận. */
export function useRegisterCredentialsSchema() {
  const { t } = useTranslation('auth')
  return z.object(passwordFields(t)).refine(
    (data) => data.password === data.confirmPassword,
    { message: t('register.passwordNotMatch'), path: ['confirmPassword'] },
  )
}

/** Panel sau của bước 2: hồ sơ, tất cả đều bắt buộc. */
export function useRegisterProfileSchema() {
  const { t } = useTranslation('auth')
  return z.object(profileFields(t))
}

export function useForgotPasswordSchema() {
  const { t } = useTranslation('auth')
  return z.object({
    email: z.string().email(t('register.invalidEmail')).optional(),
    phonenumber: z
      .string()
      .regex(PHONE_NUMBER_REGEX, t('register.phoneNumberInvalid'))
      .optional(),
  })
}

export function useForgotPasswordByEmailSchema() {
  const { t } = useTranslation('auth')
  return z.object({
    email: z.string().email(t('register.invalidEmail')),
  })
}

export function useForgotPasswordByPhoneNumberSchema() {
  const { t } = useTranslation('auth')
  return z.object({
    phonenumber: z
      .string()
      .regex(PHONE_NUMBER_REGEX, t('register.phoneNumberInvalid')),
  })
}

export function useResetPasswordSchema() {
  const { t } = useTranslation('auth')
  return z
    .object({
      newPassword: z
        .string()
        .min(AuthRules.MIN_LENGTH, {
          message: t('forgotPassword.passwordMin', {
            length: AuthRules.MIN_LENGTH,
          }),
        }),
        // .max(AuthRules.MAX_LENGTH, {
        //   message: t('forgotPassword.passwordMax', {
        //     length: AuthRules.MAX_LENGTH,
        //   }),
        // })
        // .regex(PASSWORD_REGEX, t('forgotPassword.passwordInvalid')),
      confirmPassword: z
        .string()
        .min(1, t('forgotPassword.confirmPasswordRequired')),
      token: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('forgotPassword.passwordNotMatch'),
      path: ['confirmPassword'],
    })
}

export const verifyEmailSchema = z.object({
  accessToken: z.string(),
  email: z.string().email(),
})

export type TRegisterPhoneSchema = z.infer<
  ReturnType<typeof useRegisterPhoneSchema>
>
export type TRegisterCredentialsSchema = z.infer<
  ReturnType<typeof useRegisterCredentialsSchema>
>
export type TRegisterProfileSchema = z.infer<
  ReturnType<typeof useRegisterProfileSchema>
>
export type TLoginSchema = z.infer<typeof loginSchema>
export type TResetPasswordSchema = z.infer<
  ReturnType<typeof useResetPasswordSchema>
>

export type TForgotPasswordSchema = z.infer<
  ReturnType<typeof useForgotPasswordSchema>
>
export type TVerifyEmailSchema = z.infer<typeof verifyEmailSchema>

export type TForgotPasswordByEmailSchema = z.infer<
  ReturnType<typeof useForgotPasswordByEmailSchema>
>
export type TForgotPasswordByPhoneNumberSchema = z.infer<
  ReturnType<typeof useForgotPasswordByPhoneNumberSchema>
>
