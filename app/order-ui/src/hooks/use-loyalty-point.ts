import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import {
  applyLoyaltyPoint,
  cancelReservationForOrder,
  getLoyaltyPointHistory,
  getLoyaltyPoints,
  getMyLoyaltyPointHistory,
  getMyLoyaltyPoints,
} from '@/api'
import { QUERYKEY } from '@/constants'
import { useUserStore } from '@/stores'
import { ILoyaltyPointHistoryQuery, IMyLoyaltyPointHistoryQuery } from '@/types'

export const useLoyaltyPoints = (q?: string) => {
  return useQuery({
    queryKey: [QUERYKEY.loyaltyPoints, 'total', { slug: q || '' }],
    queryFn: () => getLoyaltyPoints(q as string),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
    enabled: !!q,
  })
}

// Step 7.8: points of the signed-in user (shared-user). Own cache keys under
// the loyaltyPoints prefix, carrying the signed-in user: another customer
// signing in on the same tab must not get these cached numbers.
export const useMyLoyaltyPoints = (enabled: boolean = true) => {
  const mySlug = useUserStore((s) => s.userInfo?.slug)
  return useQuery({
    queryKey: [QUERYKEY.loyaltyPoints, 'mine', mySlug, 'total'],
    queryFn: () => getMyLoyaltyPoints(),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
    enabled: enabled && !!mySlug,
  })
}

export const useMyLoyaltyPointHistory = (
  params: IMyLoyaltyPointHistoryQuery,
  enabled: boolean = true,
) => {
  const mySlug = useUserStore((s) => s.userInfo?.slug)
  return useQuery({
    queryKey: [
      QUERYKEY.loyaltyPoints,
      'mine',
      mySlug,
      'history',
      params.page,
      params.size,
      params.fromDate,
      params.toDate,
      (params.types || []).join(','),
    ],
    queryFn: () => getMyLoyaltyPointHistory(params),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
    enabled: enabled && !!mySlug,
  })
}

export const useApplyLoyaltyPoint = () => {
  return useMutation({
    mutationFn: async ({
      orderSlug,
      pointsToUse,
    }: {
      orderSlug: string
      pointsToUse: number
    }) => applyLoyaltyPoint(orderSlug, pointsToUse),
  })
}

export const useCancelReservationForOrder = () => {
  return useMutation({
    mutationFn: async (orderSlug: string) =>
      cancelReservationForOrder(orderSlug),
  })
}

export const useLoyaltyPointHistory = (params: ILoyaltyPointHistoryQuery) => {
  return useQuery({
    queryKey: [
      QUERYKEY.loyaltyPoints,
      'history',
      params.slug,
      params.page,
      params.size,
      params.fromDate,
      params.toDate,
      (params.types || []).join(','),
    ],
    queryFn: () => getLoyaltyPointHistory(params),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
    enabled: !!params.slug,
  })
}
