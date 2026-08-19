import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCampaign,
  deleteCampaign,
  getAllCampaigns,
  getAllCampaignTypeKeys,
  getCampaignBySlug,
  updateCampaign,
} from '@/api/campaign'
import { ICreateCampaignRequest, IGetCampaignRequestParams, IUpdateCampaignRequest } from '@/types'
import { QUERYKEY } from '@/constants'

export const useGetAllCampaignTypeKeys = (enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERYKEY.campaignTypeKeys,
    queryFn: () => getAllCampaignTypeKeys(),
    enabled,
  })
}

export const useCampaigns = (request: IGetCampaignRequestParams) => {
  return useQuery({
    queryKey: [...QUERYKEY.campaigns, request],
    queryFn: () => getAllCampaigns(request),
  })
}

export const useGetCampaignBySlug = (slug: string) => {
  return useQuery({
    queryKey: [...QUERYKEY.campaign, slug],
    queryFn: () => getCampaignBySlug(slug),
    enabled: !!slug,
  })
}

export const useCreateCampaign = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ICreateCampaignRequest) => createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERYKEY.campaigns })
    },
  })
}

export const useUpdateCampaign = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: IUpdateCampaignRequest) => updateCampaign(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERYKEY.campaigns })
      queryClient.invalidateQueries({ queryKey: [...QUERYKEY.campaign, variables.slug] })
    },
  })
}

export const useDeleteCampaign = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => deleteCampaign(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERYKEY.campaigns })
    },
  })
}
