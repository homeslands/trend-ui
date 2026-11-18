import {
  IApiResponse,
  ILoyaltyPoint,
  ILoyaltyPointHistory,
  ILoyaltyPointHistoryQuery,
  IMyLoyaltyPointHistoryQuery,
  IPaginationResponse,
  IUseLoyaltyPointResponse,
} from '@/types'
import { http, httpAuth } from '@/utils'

export async function getLoyaltyPoints(
  userSlug?: string,
): Promise<IApiResponse<ILoyaltyPoint>> {
  const response = await http.get<IApiResponse<ILoyaltyPoint>>(
    `/accumulated-point/user/${userSlug}/points`,
  )
  return response.data
}

// Step 7.8 (cutover): the points of the signed-in user, read from shared-user
// (GET /accumulated-point/points and /history, the user comes from the JWT).
// getLoyaltyPoints / getLoyaltyPointHistory stay on trend for the staff
// screens (the points of another customer, role-checked).
export async function getMyLoyaltyPoints(): Promise<IApiResponse<ILoyaltyPoint>> {
  const response = await httpAuth.get<IApiResponse<ILoyaltyPoint>>(
    '/accumulated-point/points',
  )
  return response.data
}

export async function getMyLoyaltyPointHistory(
  params: IMyLoyaltyPointHistoryQuery,
): Promise<IApiResponse<IPaginationResponse<ILoyaltyPointHistory>>> {
  const response = await httpAuth.get<
    IApiResponse<IPaginationResponse<ILoyaltyPointHistory>>
  >('/accumulated-point/history', {
    params,
    paramsSerializer: {
      indexes: null, // no "[]"
    },
  })
  return response.data
}

export async function applyLoyaltyPoint(
  orderSlug?: string,
  pointsToUse?: number,
): Promise<IApiResponse<IUseLoyaltyPointResponse>> {
  const response = await http.post<IApiResponse<IUseLoyaltyPointResponse>>(
    `/accumulated-point/order/${orderSlug}/apply-points`,
    {
      pointsToUse,
    },
  )
  return response.data
}

export async function cancelReservationForOrder(
  orderSlug: string,
): Promise<IApiResponse<void>> {
  const response = await http.post<IApiResponse<void>>(
    `/accumulated-point/order/${orderSlug}/cancel-reservation`,
  )
  return response.data
}

export async function getLoyaltyPointHistory(
  params: ILoyaltyPointHistoryQuery,
): Promise<IApiResponse<IPaginationResponse<ILoyaltyPointHistory>>> {
  const { slug, ...rest } = params
  const response = await http.get<
    IApiResponse<IPaginationResponse<ILoyaltyPointHistory>>
  >(`/accumulated-point/user/${slug}/history`, {
    params: rest,
    paramsSerializer: {
      indexes: null, // bỏ "[]"
    },
  })
  return response.data
}
