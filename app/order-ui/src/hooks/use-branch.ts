import {
  createBranch,
  deleteBranch,
  getAllBranches,
  getBranchInfoForDelivery,
  updateBranch,
  createBranchConfig,
  deleteBranchConfig,
  updateBranchConfig,
  getBranchConfig,
  getSpecificBranchConfig,
  getAllBranchConfigs,
} from '@/api'
import { ICreateBranchConfigRequest, ICreateBranchRequest, IGetSpecificBranchConfigRequest, IUpdateBranchConfigRequest, IUpdateBranchRequest } from '@/types'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useUserStore } from '@/stores'

export const useBranch = () => {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => getAllBranches(),
  })
}

export const useCreateBranch = () => {
  return useMutation({
    mutationFn: async (data: ICreateBranchRequest) => {
      return createBranch(data)
    },
  })
}

export const useUpdateBranch = () => {
  return useMutation({
    mutationFn: async (data: IUpdateBranchRequest) => {
      return updateBranch(data)
    },
  })
}

export const useDeleteBranch = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteBranch(slug)
    },
  })
}

export const useGetBranchInfoForDelivery = (slug: string) => {
  const { userInfo } = useUserStore()
  return useQuery({
    queryKey: ['branchInfoForDelivery', slug],
    queryFn: async () => {
      return getBranchInfoForDelivery(slug)
    },
    enabled: !!userInfo?.slug && !!slug && slug.trim() !== '',
  })
}


export const useCreateBranchConfig = () => {
  return useMutation({
    mutationFn: async (data: ICreateBranchConfigRequest) => {
      return createBranchConfig(data)
    },
  })
}

export const useDeleteBranchConfig = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteBranchConfig(slug)
    },
  })
}

export const useUpdateBranchConfig = () => {
  return useMutation({
    mutationFn: async (data: IUpdateBranchConfigRequest) => {
      return updateBranchConfig(data)
    },
  })
}

export const useGetBranchConfig = (slug: string) => {
  return useQuery({
    queryKey: ['branchConfig', slug],
    queryFn: async () => {
      return getBranchConfig(slug)
    },
  })
}

export const useGetSpecificBranchConfig = (params: IGetSpecificBranchConfigRequest) => {
  return useQuery({
    queryKey: ['specificBranchConfig', params],
    queryFn: async () => {
      return getSpecificBranchConfig(params)
    },
  })
}

export const useGetAllBranchConfigs = (branchSlug: string) => {
  return useQuery({
    queryKey: ['branchConfigs', branchSlug],
    queryFn: async () => {
      return getAllBranchConfigs(branchSlug)
    },
    enabled: !!branchSlug && branchSlug.trim() !== '',
  })
}