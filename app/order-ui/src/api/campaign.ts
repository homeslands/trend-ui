import { http } from '@/utils'
import {
  IApiResponse,
  ICampaign,
  ICampaignTypeKey,
  IGetCampaignRequestParams,
  ICreateCampaignRequest,
  IUpdateCampaignRequest,
  IPaginationResponse,
} from '@/types'

export async function getAllCampaignTypeKeys(): Promise<IApiResponse<ICampaignTypeKey[]>> {
  const response = await http.get<IApiResponse<ICampaignTypeKey[]>>('/campaign/keys')
  if (!response || !response.data) throw new Error('No data found')
  return response.data
}

export async function getAllCampaigns(
  request: IGetCampaignRequestParams
): Promise<IApiResponse<IPaginationResponse<ICampaign>>> {
  const response = await http.get<IApiResponse<IPaginationResponse<ICampaign>>>(`/campaign/`, { params: request })
  if (!response || !response.data) throw new Error('No data found')
  return response.data
}

export async function getCampaignBySlug(slug: string): Promise<IApiResponse<ICampaign>> {
  const response = await http.get<IApiResponse<ICampaign>>(`/campaign/${slug}`)
  if (!response || !response.data) throw new Error('No data found')
  return response.data
}

export async function createCampaign(
  request: ICreateCampaignRequest,
): Promise<IApiResponse<ICampaign>> {
  const response = await http.post<IApiResponse<ICampaign>>('/campaign', request)
  if (!response || !response.data) throw new Error('No data found')
  return response.data
}

export async function updateCampaign(
  request: IUpdateCampaignRequest,
): Promise<IApiResponse<ICampaign>> {
  const response = await http.patch<IApiResponse<ICampaign>>(`/campaign/${request?.slug}`, request)
  if (!response || !response.data) throw new Error('No data found')
  return response.data
}

export async function deleteCampaign(slug: string): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(`/campaign/${slug}`)
  return response.data
}