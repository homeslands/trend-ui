import {
  authorityGroup,
  completeRegister,
  confirmEmailVerification,
  confirmForgotPassword,
  confirmPhoneNumberVerification,
  createPermission,
  deletePermission,
  initiateForgotPassword,
  initiateRegister,
  login,
  resendEmailVerification,
  resendOTPForgotPassword,
  resendPhoneNumberVerification,
  resendRegisterOtp,
  verifyEmail,
  verifyOTPForgotPassword,
  verifyPhoneNumber,
} from '@/api'
// import { QUERYKEY } from '@/constants'
import {
  ILoginRequest,
  ICompleteRegisterRequest,
  IInitiateRegisterRequest,
  IResendRegisterOtpRequest,
  IVerifyEmailRequest,
  IGetAuthorityGroupsRequest,
  ICreatePermissionRequest,
  IInitiateForgotPasswordRequest,
  IVerifyOTPForgotPasswordRequest,
  IResendOTPForgotPasswordRequest,
  IConfirmForgotPasswordRequest,
} from '@/types'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

export const useLogin = () => {
  return useMutation({
    mutationFn: async (data: ILoginRequest) => {
      const response = await login(data)
      return response
    },
  })
}

export const useInitiateRegister = () => {
  return useMutation({
    mutationFn: async (data: IInitiateRegisterRequest) => {
      return initiateRegister(data)
    },
    meta: { ignoreGlobalError: true },
  })
}

export const useResendRegisterOtp = () => {
  return useMutation({
    mutationFn: async (data: IResendRegisterOtpRequest) => {
      return resendRegisterOtp(data)
    },
    meta: { ignoreGlobalError: true },
  })
}

export const useCompleteRegister = () => {
  return useMutation({
    mutationFn: async (data: ICompleteRegisterRequest) => {
      return completeRegister(data)
    },
    meta: { ignoreGlobalError: true },
  })
}

export const useInitiateForgotPassword = () => {
  return useMutation({
    mutationFn: async (params: IInitiateForgotPasswordRequest) => {
      return initiateForgotPassword(params)
    },
    meta: { ignoreGlobalError: true },
  })
}

export const useVerifyOTPForgotPassword = () => {
  return useMutation({
    mutationFn: async (params: IVerifyOTPForgotPasswordRequest) => {
      return verifyOTPForgotPassword(params)
    },
  })
}

export const useResendOTPForgotPassword = () => {
  return useMutation({
    mutationFn: async (params: IResendOTPForgotPasswordRequest) => {
      return resendOTPForgotPassword(params)
    },
  })
}

export const useConfirmForgotPassword = () => {
  return useMutation({
    mutationFn: async (params: IConfirmForgotPasswordRequest) => {
      return confirmForgotPassword(params)
    },
  })
}

export const useVerifyEmail = () => {
  return useMutation({
    mutationFn: async (data: IVerifyEmailRequest) => {
      return verifyEmail(data)
    },
  })
}

export const useVerifyPhoneNumber = () => {
  return useMutation({
    mutationFn: async () => {
      return verifyPhoneNumber()
    },
  })
}

export const useConfirmPhoneNumberVerification = () => {
  return useMutation({
    mutationFn: async (code: string) => {
      return confirmPhoneNumberVerification(code)
    },
  })
}

export const useResendPhoneNumberVerification = () => {
  return useMutation({
    mutationFn: async () => {
      return resendPhoneNumberVerification()
    },
  })
}

export const useConfirmEmailVerification = () => {
  return useMutation({
    mutationFn: async (code: string) => {
      return confirmEmailVerification(code)
    },
  })
}

export const useResendEmailVerification = () => {
  return useMutation({
    mutationFn: async () => {
      return resendEmailVerification()
    },
  })
}

export const useGetAuthorityGroup = (q: IGetAuthorityGroupsRequest) => {
  return useQuery({
    queryKey: ['authority-group', JSON.stringify(q)],
    queryFn: () => authorityGroup(q),
    placeholderData: keepPreviousData,
  })
}

export const useCreatePermission = () => {
  return useMutation({
    mutationFn: async (data: ICreatePermissionRequest) => {
      return createPermission(data)
    },
  })
}

export const useDeletePermission = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deletePermission(slug)
    },
  })
}
