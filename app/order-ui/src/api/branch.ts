import { http } from '@/utils'
import {
  IApiResponse,
  ICreateBranchRequest,
  IBranch,
  IUpdateBranchRequest,
  IBranchInfoForDelivery,
  ICreateBranchConfigRequest,
  IUpdateBranchConfigRequest,
  IGetSpecificBranchConfigRequest,
  IBranchConfig,
} from '@/types'

export async function getAllBranches(): Promise<IApiResponse<IBranch[]>> {
  const response = await http.get<IApiResponse<IBranch[]>>('/branch')
  if (!response || !response.data) throw new Error('No data found')
  return response.data
}

export async function createBranch(
  params: ICreateBranchRequest,
): Promise<IApiResponse<IBranch>> {
  const response = await http.post<IApiResponse<IBranch>>('/branch', params)
  if (!response || !response.data) throw new Error('No data found')
  if (!response || !response.data) throw new Error('No data found')
  return response.data
}

export async function updateBranch(
  data: IUpdateBranchRequest,
): Promise<IApiResponse<IBranch>> {
  const response = await http.patch<IApiResponse<IBranch>>(
    `/branch/${data.slug}`,
    data,
  )
  if (!response || !response.data) throw new Error('No data found')
  return response.data
}

export async function deleteBranch(slug: string): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(`/branch/${slug}`)

  if (!response || !('data' in response)) {
    throw new Error('No data found')
  }

  return response.data
}

export async function getBranchInfoForDelivery(
  slug: string,
): Promise<IApiResponse<IBranchInfoForDelivery>> {
  const response = await http.get<IApiResponse<IBranchInfoForDelivery>>(
    `/branch/${slug}/delivery-info`,
  )
  if (!response || !response.data) throw new Error('No data found')
  return response.data
}

export async function createBranchConfig(
  params: ICreateBranchConfigRequest,
): Promise<IApiResponse<IBranch>> {
  const response = await http.post<IApiResponse<IBranch>>(
    '/branch-config',
    params,
  )
  return response.data
}

export async function deleteBranchConfig(
  slug: string,
): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(`/branch-config/${slug}`)
  return response.data
}

export async function updateBranchConfig(
  params: IUpdateBranchConfigRequest,
): Promise<IApiResponse<IBranch>> {
  const response = await http.patch<IApiResponse<IBranch>>(
    `/branch-config/${params.slug}`,
    params,
  )
  return response.data
}

export async function getBranchConfig(
  slug: string,
): Promise<IApiResponse<IBranch>> {
  const response = await http.get<IApiResponse<IBranch>>(
    `/branch-config/${slug}`,
  )
  return response.data
}

export async function getAllBranchConfigs(
  branchSlug: string,
): Promise<IApiResponse<IBranchConfig[]>> {
  const response = await http.get<IApiResponse<IBranchConfig[]>>(
    `/branch-config/branch/${branchSlug}`,
  )
  if (!response || !response.data) throw new Error('No data found')
  return response.data
}

export async function getSpecificBranchConfig(
  params: IGetSpecificBranchConfigRequest,
): Promise<IApiResponse<IBranch>> {
  const response = await http.get<IApiResponse<IBranch>>(
    '/branch-config/specific',
    { params },
  )
  return response.data
}