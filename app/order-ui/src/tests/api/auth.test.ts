import { httpMock } from '../__mocks__/httpMock'
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { http } from '@/utils'
import {
  login,
  initiateRegister,
  resendRegisterOtp,
  completeRegister,
  initiateForgotPassword,
  confirmForgotPassword,
  verifyEmail,
  confirmEmailVerification,
  verifyOTPForgotPassword,
} from '@/api'
import { VerificationMethod } from '@/constants'

vi.mock('@/utils', () => ({
  http: httpMock,
}))

describe('Auth API', () => {
  const serverError = {
    response: {
      status: 500,
      data: { message: 'Internal Server Error' },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('login', () => {
    it('should call login endpoint with correct parameters', async () => {
      const mockResponse = { data: { token: 'test-token', user: { id: 1 } } }
      ;(http.post as Mock).mockResolvedValue(mockResponse)

      const loginParams = { phonenumber: '1234567890', password: 'password123' }
      const result = await login(loginParams)

      expect(http.post).toHaveBeenCalledWith('/auth/login', loginParams)
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle login failure (401 Unauthorized)', async () => {
      const mockResponse = {
        response: { status: 401, data: { message: 'Unauthorized' } },
      }
      ;(http.post as Mock).mockRejectedValue(mockResponse)

      const loginParams = { phonenumber: '1234567890', password: 'password123' }

      await expect(login(loginParams)).rejects.toEqual(mockResponse)
    })

    it('should handle server error (500 Internal Server Error)', async () => {
      const mockError = {
        response: {
          status: 500,
          data: { message: 'Server error' },
        },
      }
      ;(http.post as Mock).mockRejectedValue(mockError)

      const loginParams = { phonenumber: '1234567890', password: 'password123' }

      await expect(login(loginParams)).rejects.toEqual(mockError)
    })

    it('should handle login error response', async () => {
      const mockError = {
        response: {
          status: 401,
          data: { message: 'Invalid credentials' },
        },
      }
      ;(http.post as Mock).mockRejectedValue(mockError)

      const loginParams = {
        phonenumber: '1234567890',
        password: 'wrong-password',
      }
      await expect(login(loginParams)).rejects.toEqual(mockError)
    })

    it('should handle network error', async () => {
      const networkError = new Error('Network Error')
      ;(http.post as Mock).mockRejectedValue(networkError)

      const loginParams = { phonenumber: '1234567890', password: 'password123' }

      await expect(login(loginParams)).rejects.toEqual(networkError)
    })
  })

  describe('initiateForgotPassword', () => {
    it('should call forgot password token endpoint', async () => {
      const mockResponse = { data: { success: true } }
      ;(http.post as Mock).mockResolvedValue(mockResponse)

      const email = {
        email: 'test@example.com',
        verificationMethod: VerificationMethod.EMAIL,
      }
      const result = await initiateForgotPassword(email)

      expect(http.post).toHaveBeenCalledWith(
        '/auth/forgot-password/initiate',
        email,
      )
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle initiate forgot password error response', async () => {
      const mockError = {
        response: {
          status: 404,
          data: { message: 'Email not found' },
        },
      }
      ;(http.post as Mock).mockRejectedValue(mockError)

      const params = {
        email: 'nonexistent@example.com',
        verificationMethod: VerificationMethod.EMAIL,
      }
      await expect(initiateForgotPassword(params)).rejects.toEqual(mockError)
    })

    it('should handle server error', async () => {
      ;(http.post as Mock).mockRejectedValue(serverError)
      const params = {
        email: 'test@example.com',
        verificationMethod: VerificationMethod.EMAIL,
      }
      await expect(initiateForgotPassword(params)).rejects.toEqual(serverError)
    })
  })

  describe('verifyOTPForgotPassword', () => {
    it('should call verify OTP forgot password endpoint', async () => {
      const mockResponse = { data: { success: true } }
      ;(http.post as Mock).mockResolvedValue(mockResponse)
      const params = { code: '123456' }
      const result = await verifyOTPForgotPassword(params)
      expect(http.post).toHaveBeenCalledWith(
        '/auth/forgot-password/confirm',
        params,
      )
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('confirmForgotPassword', () => {
    it('should call confirm forgot password endpoint with token and new password', async () => {
      const mockResponse = { data: { success: true } }
      ;(http.post as Mock).mockResolvedValue(mockResponse)

      const resetData = { newPassword: 'newpass123', token: 'reset-token' }
      const result = await confirmForgotPassword(resetData)

      expect(http.post).toHaveBeenCalledWith(
        '/auth/forgot-password/change',
        resetData,
      )
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle confirm forgot password error response', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Invalid or expired token' },
        },
      }
      ;(http.post as Mock).mockRejectedValue(mockError)

      const resetData = { newPassword: 'newpass123', token: 'confirm-token' }
      await expect(confirmForgotPassword(resetData)).rejects.toEqual(mockError)
    })

    it('should handle server error', async () => {
      ;(http.post as Mock).mockRejectedValue(serverError)
      const resetData = { newPassword: 'newpass123', token: 'confirm-token' }
      await expect(confirmForgotPassword(resetData)).rejects.toEqual(
        serverError,
      )
    })
  })

  describe('verifyEmail', () => {
    it('should call verify email endpoint', async () => {
      const mockResponse = { data: { success: true } }
      ;(http.post as Mock).mockResolvedValue(mockResponse)

      const verifyParams = {
        email: 'test@example.com',
        accessToken: 'test-access-token', // Add required accessToken
      }
      const result = await verifyEmail(verifyParams)

      expect(http.post).toHaveBeenCalledWith(
        '/auth/initiate-verify-email',
        verifyParams,
      )
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle verify email error response', async () => {
      const mockError = {
        response: {
          status: 403,
          data: { message: 'Invalid access token' },
        },
      }
      ;(http.post as Mock).mockRejectedValue(mockError)

      const verifyParams = {
        email: 'test@example.com',
        accessToken: 'invalid-token',
      }
      await expect(verifyEmail(verifyParams)).rejects.toEqual(mockError)
    })

    it('should handle server error', async () => {
      ;(http.post as Mock).mockRejectedValue(serverError)
      const verifyParams = {
        email: 'test@example.com',
        accessToken: 'test-token',
      }
      await expect(verifyEmail(verifyParams)).rejects.toEqual(serverError)
    })
  })

  describe('confirmEmailVerification', () => {
    it('should call confirm email verification endpoint', async () => {
      const mockResponse = { data: { success: true } }
      ;(http.post as Mock).mockResolvedValue(mockResponse)

      const code = 'verify-token'
      const result = await confirmEmailVerification(code)

      expect(http.post).toHaveBeenCalledWith(
        '/auth/confirm-email-verification/code',
        { code },
      )
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle confirm email verification error response', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Verification token expired' },
        },
      }
      ;(http.post as Mock).mockRejectedValue(mockError)

      const code = 'expired-code'
      await expect(confirmEmailVerification(code)).rejects.toEqual(mockError)
    })

    it('should handle network error', async () => {
      const mockError = new Error('Network Error')
      ;(http.post as Mock).mockRejectedValue(mockError)

      const code = 'test-code'
      await expect(confirmEmailVerification(code)).rejects.toEqual(mockError)
    })

    it('should handle server error', async () => {
      ;(http.post as Mock).mockRejectedValue(serverError)
      const code = 'test-code'
      await expect(confirmEmailVerification(code)).rejects.toEqual(serverError)
    })
  })

  describe('initiateRegister', () => {
    it('should call the initiate endpoint and return expiresAt', async () => {
      const mockResponse = {
        data: { result: { expiresAt: '2026-08-11T10:00:00.000Z' } },
      }
      ;(http.post as Mock).mockResolvedValue(mockResponse)

      const result = await initiateRegister({ phonenumber: '0376295216' })

      expect(http.post).toHaveBeenCalledWith('/auth/register/initiate', {
        phonenumber: '0376295216',
      })
      expect(result).toEqual(mockResponse.data)
    })

    it('should propagate the 119041 error when the phone number exists', async () => {
      ;(http.post as Mock).mockRejectedValue({
        response: { status: 400, data: { statusCode: 119041 } },
      })

      await expect(
        initiateRegister({ phonenumber: '0376295216' }),
      ).rejects.toMatchObject({ response: { data: { statusCode: 119041 } } })
    })
  })

  describe('resendRegisterOtp', () => {
    it('should call the resend endpoint', async () => {
      const mockResponse = {
        data: { result: { expiresAt: '2026-08-11T10:10:00.000Z' } },
      }
      ;(http.post as Mock).mockResolvedValue(mockResponse)

      const result = await resendRegisterOtp({ phonenumber: '0376295216' })

      expect(http.post).toHaveBeenCalledWith('/auth/register/resend', {
        phonenumber: '0376295216',
      })
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('completeRegister', () => {
    it('should call the complete endpoint and return tokens', async () => {
      const mockResponse = {
        data: {
          result: {
            accessToken: 'access',
            refreshToken: 'refresh',
            expireTime: '2026-08-11T11:00:00.000Z',
            expireTimeRefreshToken: '2026-08-18T11:00:00.000Z',
          },
        },
      }
      ;(http.post as Mock).mockResolvedValue(mockResponse)

      const params = {
        phonenumber: '0376295216',
        otp: 'A1B2C3',
        password: 'matkhau123',
      }
      const result = await completeRegister(params)

      expect(http.post).toHaveBeenCalledWith('/auth/register/complete', params)
      expect(result).toEqual(mockResponse.data)
    })

    it('should propagate the 119049 error when the OTP is wrong', async () => {
      ;(http.post as Mock).mockRejectedValue({
        response: { status: 400, data: { statusCode: 119049 } },
      })

      await expect(
        completeRegister({
          phonenumber: '0376295216',
          otp: 'ZZZZZZ',
          password: 'matkhau123',
        }),
      ).rejects.toMatchObject({ response: { data: { statusCode: 119049 } } })
    })
  })
})
