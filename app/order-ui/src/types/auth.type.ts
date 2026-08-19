import { VerificationMethod } from '@/constants'

export interface ILoginRequest {
  phonenumber: string
  password: string
}

export interface ILoginResponse {
  message: string
  result: {
    accessToken: string
    expireTime: string
    refreshToken: string
    expireTimeRefreshToken: string
  }
  method: string
  status: number
  timestamp: string
}

export interface IInitiateRegisterRequest {
  phonenumber: string
}

export interface IInitiateRegisterResponse {
  expiresAt: string
}

export interface IResendRegisterOtpRequest {
  phonenumber: string
}

export interface ICompleteRegisterRequest {
  phonenumber: string
  otp: string
  password: string
}

export interface ICompleteRegisterResponse {
  accessToken: string
  refreshToken: string
  expireTime: string
  expireTimeRefreshToken: string
}

export interface IInitiateForgotPasswordRequest {
  email?: string
  phonenumber?: string
  verificationMethod: VerificationMethod
}

export interface IInitiateForgotPasswordResponse {
  expiresAt: string
}

export interface IResendOTPForgotPasswordRequest {
  email?: string
  phonenumber?: string
  verificationMethod: VerificationMethod
}

export interface IConfirmForgotPasswordRequest {
  newPassword: string
  token: string
}

export interface IVerifyOTPForgotPasswordRequest {
  code: string
}

export interface IVerifyOTPForgotPasswordResponse {
  token: string
}

export interface IRefreshTokenResponse {
  expireTime: string
  expireTimeRefreshToken: string
  accessToken: string
  refreshToken: string
}

export interface IToken {
  scope: {
    role: string
    permissions: string[]
  }
}
