import { describe, it, expect } from 'vitest'

import viToast from '@/locales/vi/toast.json'
import enToast from '@/locales/en/toast.json'
import viAuth from '@/locales/vi/auth.json'
import enAuth from '@/locales/en/auth.json'

const REGISTER_TOAST_KEYS = [
  'sendOtpFailed',
  'phoneNumberAlreadyExists',
  'registerAccountAlreadyCreated',
  'registerOtpAlreadySent',
  'registerOtpNotFound',
  'registerOtpExpired',
  'registerOtpInvalid',
  'registerOtpResendTooSoon',
  'registerOtpMaxAttempts',
  'registerOtpSent',
]

const REGISTER_AUTH_KEYS = [
  'stepPhone',
  'stepVerify',
  'phoneTitle',
  'phoneSubtitle',
  'continue',
  'otpTitle',
  'otpSentTo',
  'otpExpiresIn',
  'otpExpired',
  'otpSentEarlier',
  'resend',
  'resendIn',
  'sendNewCode',
  'createAccount',
  'changePhone',
  'changePhoneTitle',
  'changePhoneMessage',
  'changePhoneConfirm',
  'backToOtp',
  'otpInvalid',
  'stepProfile',
  'profileTitle',
  'profileSubtitle',
  'complete',
  'goToLogin',
  'goToForgotPassword',
  'phoneAlreadyRegistered',
]

describe('register i18n keys', () => {
  it.each([
    ['vi', viToast],
    ['en', enToast],
  ])('%s toast.json should define every register toast key', (_lng, file) => {
    const toast = (file as { toast: Record<string, string> }).toast
    REGISTER_TOAST_KEYS.forEach((key) => {
      expect(toast[key], `missing toast.${key}`).toBeTruthy()
    })
  })

  it.each([
    ['vi', viAuth],
    ['en', enAuth],
  ])('%s auth.json should define every register key', (_lng, file) => {
    const register = (file as { register: Record<string, string> }).register
    REGISTER_AUTH_KEYS.forEach((key) => {
      expect(register[key], `missing register.${key}`).toBeTruthy()
    })
  })
})
