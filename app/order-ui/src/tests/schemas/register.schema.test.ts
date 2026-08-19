import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import {
  useRegisterPhoneSchema,
  useRegisterCredentialsSchema,
  useRegisterProfileSchema,
} from '@/schemas'

describe('useRegisterPhoneSchema', () => {
  const schema = useRegisterPhoneSchema()

  it('should accept a 10 digit phone number', () => {
    expect(schema.safeParse({ phonenumber: '0376295216' }).success).toBe(true)
  })

  it.each([
    ['037629521', 'too short'],
    ['03762952160', 'too long'],
    ['037629521a', 'not all digits'],
    ['', 'empty'],
    // 10 chữ số nhưng không phải số di động VN: nhà mạng từ chối gửi OTP và
    // backend trả 119028, một lỗi khách không hiểu nổi. Chặn ngay ở client.
    ['7788766666', 'does not start with 0'],
    ['0123456789', 'invalid mobile prefix'],
    ['0212345678', 'landline prefix'],
  ])('should reject %s (%s)', (phonenumber) => {
    expect(schema.safeParse({ phonenumber }).success).toBe(false)
  })

  it.each([['0376295216'], ['0987654321'], ['0512345678'], ['0812345678']])(
    'should accept the Vietnamese mobile number %s',
    (phonenumber) => {
      expect(schema.safeParse({ phonenumber }).success).toBe(true)
    },
  )
})

describe('useRegisterCredentialsSchema', () => {
  const schema = useRegisterCredentialsSchema()
  const valid = { password: 'matkhau1', confirmPassword: 'matkhau1' }

  it('should accept a password with at least 8 chars, one letter and one digit', () => {
    expect(schema.safeParse(valid).success).toBe(true)
  })

  it.each([
    ['mat1', 'too short'],
    ['matkhaudai', 'no digit'],
    ['12345678', 'no letter'],
  ])('should reject password %s (%s)', (password) => {
    expect(
      schema.safeParse({ password, confirmPassword: password }).success,
    ).toBe(false)
  })

  it('should reject when the confirmation does not match', () => {
    const result = schema.safeParse({ ...valid, confirmPassword: 'matkhau2' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['confirmPassword'])
    }
  })
})

describe('useRegisterProfileSchema', () => {
  const schema = useRegisterProfileSchema()
  const valid = { lastName: 'Phan Quyết', firstName: 'Thắng', dob: '01/01/1990' }

  it('should accept a complete profile', () => {
    expect(schema.safeParse(valid).success).toBe(true)
  })

  it.each(['firstName', 'lastName', 'dob'])(
    'should reject a profile with %s missing',
    (field) => {
      expect(schema.safeParse({ ...valid, [field]: '' }).success).toBe(false)
    },
  )

  it('should reject dob: null with the translated required message, not zod default', () => {
    // DatePicker phát ra null khi khách bỏ chọn ngày; nếu schema không nhận
    // null thì zod báo "Expected string, received null" bằng tiếng Anh.
    const result = schema.safeParse({ ...valid, dob: null })
    expect(result.success).toBe(false)
    if (!result.success) {
      const dobIssue = result.error.issues.find(
        (issue) => issue.path[0] === 'dob',
      )
      expect(dobIssue?.message).toBe('register.dobRequired')
    }
  })

  it('should reject a name containing digits', () => {
    expect(schema.safeParse({ ...valid, firstName: 'Thang1' }).success).toBe(
      false,
    )
  })

  it('should reject a name longer than 100 characters', () => {
    expect(
      schema.safeParse({ ...valid, firstName: 'a'.repeat(101) }).success,
    ).toBe(false)
  })

  it('should reject a malformed date of birth', () => {
    expect(schema.safeParse({ ...valid, dob: '1990-01-01' }).success).toBe(false)
  })

  it('should reject a date of birth in the future', () => {
    const nextYear = new Date().getFullYear() + 1
    expect(
      schema.safeParse({ ...valid, dob: `01/01/${nextYear}` }).success,
    ).toBe(false)
  })
})
