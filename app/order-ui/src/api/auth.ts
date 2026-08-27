import {
  IApiResponse,
  IAuthScope,
  ILoginResponse,
  IVerifyEmailRequest,
  IGetAuthorityGroupsRequest,
  IAuthorityGroup,
  ICreatePermissionRequest,
  IInitiateRegisterRequest,
  IInitiateRegisterResponse,
  IResendRegisterOtpRequest,
  ICompleteRegisterRequest,
  ICompleteRegisterResponse,
  IEmailVerificationResponse,
  IVerifyPhoneNumberRequest,
  IInitiateForgotPasswordRequest,
  IVerifyOTPForgotPasswordRequest,
  IResendOTPForgotPasswordRequest,
  IConfirmForgotPasswordRequest,
  IVerifyOTPForgotPasswordResponse,
  IInitiateForgotPasswordResponse,
} from '@/types'
import { http, httpAuth } from '@/utils'

// Đăng nhập/đăng ký/xác thực OTP/quên mật khẩu: gọi shared-user (identity
// service) qua httpAuth, không còn gọi trend — xem progress/trend-ui.md
// giai đoạn 1.
export async function login(params: {
  phonenumber: string
  password: string
}): Promise<ILoginResponse> {
  const response = await httpAuth.post<ILoginResponse>('/auth/login', params)
  return response.data
}

export async function getAuthScope(): Promise<IApiResponse<IAuthScope>> {
  const response = await http.get<IApiResponse<IAuthScope>>('/auth/scope')
  return response.data
}

export async function initiateRegister(
  params: IInitiateRegisterRequest,
): Promise<IApiResponse<IInitiateRegisterResponse>> {
  const response = await httpAuth.post<IApiResponse<IInitiateRegisterResponse>>(
    '/auth/register/initiate',
    params,
  )
  return response.data
}

export async function resendRegisterOtp(
  params: IResendRegisterOtpRequest,
): Promise<IApiResponse<IInitiateRegisterResponse>> {
  const response = await httpAuth.post<IApiResponse<IInitiateRegisterResponse>>(
    '/auth/register/resend',
    params,
  )
  return response.data
}

export async function completeRegister(
  params: ICompleteRegisterRequest,
): Promise<IApiResponse<ICompleteRegisterResponse>> {
  const response = await httpAuth.post<IApiResponse<ICompleteRegisterResponse>>(
    '/auth/register/complete',
    params,
  )
  return response.data
}

export async function initiateForgotPassword(
  params: IInitiateForgotPasswordRequest,
): Promise<IApiResponse<IInitiateForgotPasswordResponse>> {
  const response = await httpAuth.post<
    IApiResponse<IInitiateForgotPasswordResponse>
  >('/auth/forgot-password/initiate', params)
  return response.data
}

export async function verifyOTPForgotPassword(
  params: IVerifyOTPForgotPasswordRequest,
): Promise<IApiResponse<IVerifyOTPForgotPasswordResponse>> {
  const response = await httpAuth.post<
    IApiResponse<IVerifyOTPForgotPasswordResponse>
  >('/auth/forgot-password/confirm', params)
  return response.data
}

export async function resendOTPForgotPassword(
  params: IResendOTPForgotPasswordRequest,
): Promise<IApiResponse<IInitiateForgotPasswordResponse>> {
  const response = await httpAuth.post<
    IApiResponse<IInitiateForgotPasswordResponse>
  >('/auth/forgot-password/resend', params)
  return response.data
}

export async function confirmForgotPassword(
  params: IConfirmForgotPasswordRequest,
): Promise<IApiResponse<null>> {
  const response = await httpAuth.post<IApiResponse<null>>(
    '/auth/forgot-password/change',
    params,
  )
  return response.data
}

export async function verifyEmail(
  verifyParams: IVerifyEmailRequest,
): Promise<IApiResponse<IEmailVerificationResponse>> {
  const response = await httpAuth.post<IApiResponse<IEmailVerificationResponse>>(
    `/auth/initiate-verify-email`,
    verifyParams,
  )
  return response.data
}

export async function verifyPhoneNumber(): Promise<
  IApiResponse<IVerifyPhoneNumberRequest>
> {
  const response = await httpAuth.post<IApiResponse<IVerifyPhoneNumberRequest>>(
    `/auth/initiate-verify-phone-number`,
  )
  return response.data
}

export async function confirmEmailVerification(
  code: string,
): Promise<IApiResponse<null>> {
  const response = await httpAuth.post<IApiResponse<null>>(
    `/auth/confirm-email-verification/code`,
    { code },
  )
  return response.data
}

export async function confirmPhoneNumberVerification(
  code: string,
): Promise<IApiResponse<null>> {
  const response = await httpAuth.post<IApiResponse<null>>(
    `/auth/confirm-phone-number-verification/code`,
    { code },
  )
  return response.data
}

export async function resendEmailVerification(): Promise<
  IApiResponse<IEmailVerificationResponse>
> {
  const response = await httpAuth.post<IApiResponse<IEmailVerificationResponse>>(
    `/auth/resend-verify-email`,
  )
  return response.data
}

export async function resendPhoneNumberVerification(): Promise<
  IApiResponse<IVerifyPhoneNumberRequest>
> {
  const response = await httpAuth.post<IApiResponse<IVerifyPhoneNumberRequest>>(
    `/auth/resend-verify-phone-number`,
  )
  return response.data
}

export async function authorityGroup(
  params: IGetAuthorityGroupsRequest,
): Promise<IApiResponse<IAuthorityGroup[]>> {
  const response = await http.get<IApiResponse<IAuthorityGroup[]>>(
    '/authority-group',
    {
      params,
    },
  )
  return response.data
}

export async function createPermission(
  params: ICreatePermissionRequest,
): Promise<IApiResponse<null>> {
  const response = await http.post<IApiResponse<null>>(
    '/permission/bulk',
    params,
  )
  return response.data
}

export async function deletePermission(
  slug: string,
): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(`/permission/${slug}`)
  return response.data
}
