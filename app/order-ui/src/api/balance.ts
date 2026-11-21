import { IApiResponse, IBalanceAnalysisResponse, IBalanceResponse } from '@/types'
import { http, httpAuth } from '@/utils'

export async function getUserBalance(slug?: string, balance?: string): Promise<IApiResponse<IBalanceResponse>> {
  const url = balance ? `/balance?userSlug=${slug}&balance=${balance}` : `/balance?userSlug=${slug}`
  const response = await http.get<IApiResponse<IBalanceResponse>>(url)
  return response.data
}

// Step 7.8 (cutover): the balance of the signed-in user, read from shared-user
// (GET /balance, the user comes from the JWT). getUserBalance stays on trend
// for the staff screens (the balance of another customer, role-checked).
export async function getMyBalance(): Promise<IApiResponse<IBalanceResponse>> {
  const response = await httpAuth.get<IApiResponse<IBalanceResponse>>('/balance')
  return response.data
}

export async function analyzeBalance(): Promise<IApiResponse<IBalanceAnalysisResponse>> {
  const url = `/balance/analysis`;
  const response = await http.get<IApiResponse<IBalanceAnalysisResponse>>(url)
  return response.data;
}
