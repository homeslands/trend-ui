import { z } from 'zod'
import { useTranslation } from 'react-i18next'

import {
  AuthRules,
  EMOJI_REGEX,
  NAME_REGEX,
  // PASSWORD_REGEX,
  PHONE_NUMBER_REGEX,
} from '@/constants'
import moment from 'moment'

export const userInfoSchema = z.object({
  slug: z.string(),
  image: z.string().optional(),
  phonenumber: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  dob: z.string(),
  email: z.string(),
  address: z.string(),
  branch: z.string(),
})

export const userRoleSchema = z.object({
  slug: z.string(),
  name: z.string(),
  role: z.string(),
})

export function useCreateUserSchema() {
  const { t } = useTranslation(['auth'])
  const { t: tProfile } = useTranslation(['profile'])
  return z
    .object({
      phonenumber: z
        .string()
        .min(10, t('register.phoneNumberRequired'))
        .max(10, t('register.phoneNumberMaxLength'))
        .regex(PHONE_NUMBER_REGEX, t('register.phoneNumberInvalid')),
      isVerifiedPhonenumber: z.boolean().optional(),
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
      firstName: z
        .string()
        .min(AuthRules.MIN_NAME_LENGTH, tProfile('profile.firstNameRequired'))
        .max(AuthRules.MAX_NAME_LENGTH, tProfile('profile.firstNameTooLong'))
        .regex(NAME_REGEX, tProfile('profile.firstNameInvalid'))
        .refine((val) => !EMOJI_REGEX.test(val), {
          message: tProfile('profile.firstNameEmojiInvalid'),
        }),

      lastName: z
        .string()
        .min(AuthRules.MIN_NAME_LENGTH, tProfile('profile.lastNameRequired'))
        .max(AuthRules.MAX_NAME_LENGTH, tProfile('profile.lastNameTooLong'))
        .regex(NAME_REGEX, tProfile('profile.lastNameInvalid'))
        .refine((val) => !EMOJI_REGEX.test(val), {
          message: tProfile('profile.lastNameEmojiInvalid'),
        }),
      dob: z.preprocess(
        (val) => {
          if (!val || (typeof val === 'string' && val.trim() === '')) return null
          return typeof val === 'string' ? val.trim() : null
        },
        z
          .string()
          .refine((val) => moment(val, 'DD/MM/YYYY', true).isValid(), {
            message: tProfile('profile.dobInvalid'),
          })
          .nullable()
          .optional(),
      ),
      role: z.string().min(1, t('register.roleRequired')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('register.passwordNotMatch'),
      path: ['confirmPassword'],
    })
}

export function useCreateEmployeeSchema() {
  const { t } = useTranslation('auth')
  const { t: tProfile } = useTranslation('profile')
  return z
    .object({
      phonenumber: z
        .string()
        .min(10, t('register.phoneNumberRequired'))
        .max(10, t('register.phoneNumberMaxLength'))
        .regex(PHONE_NUMBER_REGEX, t('register.phoneNumberInvalid')),
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
      firstName: z
        .string()
        .min(AuthRules.MIN_NAME_LENGTH, tProfile('profile.firstNameRequired'))
        .max(AuthRules.MAX_NAME_LENGTH, tProfile('profile.firstNameTooLong'))
        .regex(NAME_REGEX, tProfile('profile.firstNameInvalid'))
        .refine((val) => !EMOJI_REGEX.test(val), {
          message: tProfile('profile.firstNameEmojiInvalid'),
        }),

      lastName: z
        .string()
        .min(AuthRules.MIN_NAME_LENGTH, tProfile('profile.lastNameRequired'))
        .max(AuthRules.MAX_NAME_LENGTH, tProfile('profile.lastNameTooLong'))
        .regex(NAME_REGEX, tProfile('profile.lastNameInvalid'))
        .refine((val) => !EMOJI_REGEX.test(val), {
          message: tProfile('profile.lastNameEmojiInvalid'),
        }),
      dob: z.preprocess(
        (val) => {
          if (!val || (typeof val === 'string' && val.trim() === '')) return null
          return typeof val === 'string' ? val.trim() : null
        },
        z
          .string()
          .refine((val) => moment(val, 'DD/MM/YYYY', true).isValid(), {
            message: tProfile('profile.dobInvalid'),
          })
          .nullable()
          .optional(),
      ),
      role: z.string().min(1, t('register.roleRequired')),
      branch: z.string().min(1, t('register.branchRequired')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('register.passwordNotMatch'),
      path: ['confirmPassword'],
    })
}

export function useUpdateUserSchema() {
  const { t: tProfile } = useTranslation('profile')
  return z.object({
    slug: z.string(),
    firstName: z
      .string()
      .min(AuthRules.MIN_NAME_LENGTH, tProfile('profile.firstNameRequired'))
      .max(AuthRules.MAX_NAME_LENGTH, tProfile('profile.firstNameTooLong'))
      .regex(NAME_REGEX, tProfile('profile.firstNameInvalid'))
      .refine((val) => !EMOJI_REGEX.test(val), {
        message: tProfile('profile.firstNameEmojiInvalid'),
      }),

    lastName: z
      .string()
      .min(AuthRules.MIN_NAME_LENGTH, tProfile('profile.lastNameRequired'))
      .max(AuthRules.MAX_NAME_LENGTH, tProfile('profile.lastNameTooLong'))
      .regex(NAME_REGEX, tProfile('profile.lastNameInvalid'))
      .refine((val) => !EMOJI_REGEX.test(val), {
        message: tProfile('profile.lastNameEmojiInvalid'),
      }),
    isVerifiedPhonenumber: z.boolean().optional(),
    dob: z.preprocess(
      (val) => {
        if (!val || (typeof val === 'string' && val.trim() === '')) return null
        return typeof val === 'string' ? val.trim() : null
      },
      z
        .string()
        .refine((val) => moment(val, 'DD/MM/YYYY', true).isValid(), {
          message: tProfile('profile.dobInvalid'),
        })
        .nullable()
        .optional(),
    ),

    email: z
      .string()
      .min(1, {
        message: tProfile('profile.emailRequired'),
      })
      .email({ message: tProfile('profile.emailInvalid') })
      .optional(),
    address: z
      .string()
      .min(1, tProfile('profile.addressRequired'))
      .max(AuthRules.MAX_ADDRESS_LENGTH, tProfile('profile.addressTooLong'))
      .refine((val) => !EMOJI_REGEX.test(val), {
        message: tProfile('profile.addressEmojiInvalid'),
      }),

    branch: z.string().optional(),
  })
}

export function useUpdateEmployeeSchema() {
  const { t: tProfile } = useTranslation('profile')
  return z.object({
    slug: z.string(),
    firstName: z
      .string()
      .min(AuthRules.MIN_NAME_LENGTH, tProfile('profile.firstNameRequired'))
      .max(AuthRules.MAX_NAME_LENGTH, tProfile('profile.firstNameTooLong'))
      .regex(NAME_REGEX, tProfile('profile.firstNameInvalid'))
      .refine((val) => !EMOJI_REGEX.test(val), {
        message: tProfile('profile.firstNameEmojiInvalid'),
      }),

    lastName: z
      .string()
      .min(AuthRules.MIN_NAME_LENGTH, tProfile('profile.lastNameRequired'))
      .max(AuthRules.MAX_NAME_LENGTH, tProfile('profile.lastNameTooLong'))
      .regex(NAME_REGEX, tProfile('profile.lastNameInvalid'))
      .refine((val) => !EMOJI_REGEX.test(val), {
        message: tProfile('profile.lastNameEmojiInvalid'),
      }),

    dob: z.preprocess(
      (val) => {
        if (!val || (typeof val === 'string' && val.trim() === '')) return null
        return typeof val === 'string' ? val.trim() : null
      },
      z
        .string()
        .refine((val) => moment(val, 'DD/MM/YYYY', true).isValid(), {
          message: tProfile('profile.dobInvalid'),
        })
        .nullable()
        .optional(),
    ),

    email: z
      .string()
      .min(1, {
        message: tProfile('profile.emailRequired'),
      })
      .email({ message: tProfile('profile.emailInvalid') })
      .optional(),
    address: z
      .string()
      .min(1, tProfile('profile.addressRequired'))
      .max(AuthRules.MAX_ADDRESS_LENGTH, tProfile('profile.addressTooLong'))
      .refine((val) => !EMOJI_REGEX.test(val), {
        message: tProfile('profile.addressEmojiInvalid'),
      }),

    branch: z.string().optional(),
  })
}

export function useCreateUserGroupSchema() {
  const { t } = useTranslation(['customer'])
  return z.object({
    name: z.string().min(1, t('customer.userGroup.nameRequired')),
    description: z.string().optional(),
  })
}

export function useUpdateUserGroupSchema() {
  const { t } = useTranslation(['customer'])
  return z.object({
    slug: z.string(),
    name: z.string().min(1, t('customer.userGroup.nameRequired')),
    description: z.string().optional(),
  })
}

export type TUpdateUserGroupSchema = z.infer<
  ReturnType<typeof useUpdateUserGroupSchema>
>

export type TCreateUserGroupSchema = z.infer<
  ReturnType<typeof useCreateUserGroupSchema>
>

export type TUserInfoSchema = z.infer<typeof userInfoSchema>
export type TUserRoleSchema = z.infer<typeof userRoleSchema>
export type TCreateUserSchema = z.infer<ReturnType<typeof useCreateUserSchema>>
export type TCreateEmployeeSchema = z.infer<
  ReturnType<typeof useCreateEmployeeSchema>
>
export type TUpdateUserSchema = z.infer<ReturnType<typeof useUpdateUserSchema>>
export type TUpdateEmployeeSchema = z.infer<
  ReturnType<typeof useUpdateEmployeeSchema>
>
