import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { QUERYKEY } from '@/constants'
import { exportAllCardOrderRevenueApi, exportPdfCardOrderRevenueApi, getAllCardOrderRevenueApi } from '@/api/card-order-revenue'
import { ICardOrderRevenueQuery } from '@/types/card-order-revenue.type'

export const useCardOrderRevenue = (q: ICardOrderRevenueQuery) => {
  return useQuery({
    queryKey: [QUERYKEY.cardOrderRevenue, JSON.stringify(q)],
    queryFn: () => getAllCardOrderRevenueApi(q),
    placeholderData: keepPreviousData,
  })
}


export const useExportCardOrderRevenue = () => {
  return useMutation({
    mutationFn: async (params) => {
      const blob = await exportAllCardOrderRevenueApi(params)
      const filename = `card-order-renenue-${new Date().toISOString().split('T')[0]}.xlsx`
      return {
        blob, filename
      }
    },
  })
}

export const useExportPdfCardOrderRevenue = () => {
  return useMutation({
    mutationFn: async (params) => {
      const blob = await exportPdfCardOrderRevenueApi(params)
      const filename = `card-order-renenue-${new Date().toISOString().split('T')[0]}.pdf`
      return {
        blob, filename
      }
    },
  })
}
