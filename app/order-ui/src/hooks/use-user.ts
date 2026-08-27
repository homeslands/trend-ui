import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import {
  addMultipleUserGroupMember,
  addUserGroupMember,
  completeRegistration,
  createMembershipCard,
  createMultipleMembershipCard,
  createUser,
  createUserGroup,
  deleteMembershipCard,
  deleteUserGroup,
  deleteUserGroupMember,
  getAllUserGroups,
  getUserBySlug,
  getUserGroupBySlug,
  getUserGroupMemberBySlug,
  getUserGroupMembers,
  getUserIdentityCode,
  exportExcelUsers,
  getUsers,
  getUserStatistics,
  lockUser,
  replaceMembershipCard,
  resetPassword,
  toggleMembershipCard,
  triggerBirthdayCampaign,
  updateUser,
  updateUserGroup,
  updateUserRole,
} from '@/api'
import {
  IAddMultipleUserGroupMemberRequest,
  IAddUserGroupMemberRequest,
  ICompleteRegistrationRequest,
  ICreateMembershipCardRequest,
  ICreateMultipleMembershipCardRequest,
  ICreateUserGroupRequest,
  ICreateUserRequest,
  IGetAllUserGroupRequest,
  IGetUserGroupMemberRequest,
  IReplaceMembershipCardRequest,
  IUpdateUserGroupRequest,
  IUpdateUserRequest,
  IUserExportQuery,
  IUserQuery,
  IUserStatisticsQuery,
} from '@/types'
import { QUERYKEY } from '@/constants'

export const useUsers = (q: IUserQuery | null, enabled?: boolean) => {
  return useQuery({
    queryKey: ['users', JSON.stringify(q)],
    queryFn: () => (q ? getUsers(q) : Promise.resolve(null)),
    placeholderData: keepPreviousData,
    enabled: !!q && !!enabled,
  })
}

export const useExportExcelUsers = () => {
  return useMutation({
    mutationFn: async (q: IUserExportQuery) => {
      return exportExcelUsers(q)
    },
  })
}

export const useUserBySlug = (slug: string) => {
  return useQuery({
    queryKey: ['user', slug],
    queryFn: () => getUserBySlug(slug),
    placeholderData: keepPreviousData,
    enabled: !!slug,
  })
}

export const useCreateUser = () => {
  return useMutation({
    mutationFn: async (data: ICreateUserRequest) => {
      return createUser(data)
    },
  })
}

export const useUpdateUser = () => {
  return useMutation({
    mutationFn: async (data: IUpdateUserRequest) => {
      return updateUser(data)
    },
  })
}

export const useResetPassword = () => {
  return useMutation({
    mutationFn: async (phonenumber: string) => {
      return resetPassword(phonenumber)
    },
  })
}

export const useLockUser = () => {
  return useMutation({
    mutationFn: async (phonenumber: string) => {
      return lockUser(phonenumber)
    },
  })
}

export const useUpdateUserRole = () => {
  return useMutation({
    mutationFn: async ({
      phonenumber,
      role,
    }: {
      phonenumber: string
      role: string
    }) => {
      return updateUserRole(phonenumber, role)
    },
  })
}

export const useUserGroups = (
  params: IGetAllUserGroupRequest,
  enabled?: boolean,
) => {
  return useQuery({
    queryKey: [QUERYKEY.userGroups, JSON.stringify(params)],
    queryFn: () => getAllUserGroups(params),
    placeholderData: keepPreviousData,
    enabled: !!params && !!enabled,
  })
}

export const useUserGroupBySlug = (slug: string) => {
  return useQuery({
    queryKey: [QUERYKEY.userGroup, slug],
    queryFn: () => getUserGroupBySlug(slug),
    placeholderData: keepPreviousData,
    enabled: !!slug,
  })
}

export const useCreateUserGroup = () => {
  return useMutation({
    mutationFn: async (data: ICreateUserGroupRequest) => {
      return createUserGroup(data)
    },
  })
}

export const useUpdateUserGroup = () => {
  return useMutation({
    mutationFn: async (param: IUpdateUserGroupRequest) => {
      return updateUserGroup(param)
    },
  })
}

export const useDeleteUserGroup = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteUserGroup(slug)
    },
  })
}

export const useUserGroupMembers = (params: IGetUserGroupMemberRequest) => {
  return useQuery({
    queryKey: [QUERYKEY.userGroupMembers, JSON.stringify(params)],
    queryFn: () => getUserGroupMembers(params),
    placeholderData: keepPreviousData,
    enabled: !!params,
  })
}

export const useUserGroupMemberBySlug = (slug: string) => {
  return useQuery({
    queryKey: [QUERYKEY.userGroupMember, slug],
    queryFn: () => getUserGroupMemberBySlug(slug),
    placeholderData: keepPreviousData,
    enabled: !!slug,
  })
}

export const useAddGroupMember = () => {
  return useMutation({
    mutationFn: async (data: IAddUserGroupMemberRequest) => {
      return addUserGroupMember(data)
    },
  })
}

export const useAddMultipleGroupMember = () => {
  return useMutation({
    mutationFn: async (data: IAddMultipleUserGroupMemberRequest) => {
      return addMultipleUserGroupMember(data)
    },
  })
}

export const useDeleteUserGroupMember = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteUserGroupMember(slug)
    },
  })
}

// Membership card
export const useCreateMembershipCard = () => {
  return useMutation({
    mutationFn: async (data: ICreateMembershipCardRequest) => {
      return createMembershipCard(data)
    },
  })
}

export const useCreateMultipleMembershipCard = () => {
  return useMutation({
    mutationFn: async (data: ICreateMultipleMembershipCardRequest) => {
      return createMultipleMembershipCard(data)
    },
  })
}

export const useToggleMembershipCard = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return toggleMembershipCard(slug)
    },
  })
}

export const useReplaceMembershipCard = () => {
  return useMutation({
    mutationFn: async (data: IReplaceMembershipCardRequest) => {
      return replaceMembershipCard(data)
    },
  })
}

export const useDeleteMembershipCard = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteMembershipCard(slug)
    },
  })
}


export const useCompleteRegistration = () => {
  return useMutation({
    mutationFn: async (data: ICompleteRegistrationRequest) => {
      return completeRegistration(data)
    },
  })
}

export const useGetUserIdentityCode = () => {
  return useMutation({
    mutationFn: async () => {
      return getUserIdentityCode()
    },
  })
}

export const useUserStatistics = (params: IUserStatisticsQuery, enabled?: boolean) => {
  return useQuery({
    queryKey: [QUERYKEY.userStatistics, JSON.stringify(params)],
    queryFn: () => getUserStatistics(params),
    placeholderData: keepPreviousData,
    enabled: !!params && !!enabled,
  })
}

export const useTriggerBirthdayCampaign = () => {
  return useMutation({
    mutationFn: () => triggerBirthdayCampaign(),
  })
}
