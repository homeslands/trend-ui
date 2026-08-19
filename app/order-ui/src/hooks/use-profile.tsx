import { getProfile, updateProfile, updatePassword, uploadProfilePicture, deleteAccount } from '@/api'
import { QUERYKEY } from '@/constants'
import { IUpdateProfileRequest, IUpdatePasswordRequest, IDeleteAccountRequest } from '@/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useProfile = () => {
  return useQuery({
    queryKey: [QUERYKEY.profile],
    queryFn: async () => getProfile(),
  })
}

export const useUpdateProfile = () => {
  return useMutation({
    mutationFn: async (data: IUpdateProfileRequest) => {
      return updateProfile(data)
    },
  })
}

export const useUpdatePassword = () => {
  return useMutation({
    mutationFn: async (data: IUpdatePasswordRequest) => {
      return updatePassword(data)
    },
  })
}

export const useUploadProfilePicture = () => {
  return useMutation({
    mutationFn: async (file: File) => {
      return uploadProfilePicture(file)
    },
  })
}

export const useDeleteAccount = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: IDeleteAccountRequest) => {
      return deleteAccount(data)
    },
    onSuccess: () => {
      // removeQueries chứ không invalidateQueries: tài khoản đã bị xoá nên
      // invalidate sẽ refetch bằng token vừa chết và nhận về 401.
      queryClient.removeQueries({ queryKey: [QUERYKEY.account] })
    },
  })
}


