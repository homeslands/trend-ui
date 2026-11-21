/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useCallback, useMemo } from 'react'
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  keepPreviousData,
} from '@tanstack/react-query'
import {
  getMyPointTransactions,
  getPointTransactions,
  exportAllSystemPointTransactions,
  analyzePointTransactions,
} from '@/api/point-transaction'
import {
  IMyPointTransactionQuery,
  IPointTransaction,
  UsePointTransactionsFilters,
} from '@/types'
import { PointTransactionType } from '@/constants'
import { useUserStore } from '@/stores'
import moment from 'moment'

interface UseMyPointTransactionsProps {
  pageSize?: number
  enabled?: boolean
}

// Step 7.8 (cutover): the coin history of the signed-in user, read from
// shared-user (getMyPointTransactions, the user comes from the JWT). Only the
// self-view screen uses it; the staff screens keep useSystemPointTransactions
// (trend, role-checked). No export here (QD-T7): the exports of trend need
// Manager or above, so the buttons left the customer screen. The cache keys
// carry the signed-in user (another customer on the same tab must not get
// this history from the cache).
export function useMyPointTransactions({
  pageSize = 10,
  enabled = true,
}: UseMyPointTransactionsProps) {
  const mySlug = useUserStore((s) => s.userInfo?.slug)
  const today = moment()
  const [filters, setFilters] = useState<UsePointTransactionsFilters>({
    type: PointTransactionType.ALL,
    fromDate: today.startOf('month').format('YYYY-MM-DD'),
    toDate: today.endOf('month').format('YYYY-MM-DD'),
  })
  const {
    data: transactionsData,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['pointTransactions', 'mine', mySlug, filters],
    queryFn: async ({ pageParam }) => {
      const params: IMyPointTransactionQuery = {
        page: pageParam as number,
        size: pageSize,
      }

      // Add filters. Tên nội bộ vẫn là `fromDate`/`toDate` (UI trang cá nhân dùng),
      // nhưng trên DÂY phải là `startDate`/`endDate` — BE đã đổi tên ở
      // `FindAllPointTransactionDto` và validate với `whitelist: true`, gửi tên cũ sẽ bị
      // loại bỏ âm thầm và mất luôn bộ lọc thời gian.
      if (filters.fromDate) params.startDate = filters.fromDate
      if (filters.toDate) params.endDate = filters.toDate
      if (filters.type !== PointTransactionType.ALL) params.type = filters.type

      return getMyPointTransactions(params)
    },
    enabled: enabled && !!mySlug,
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.result.hasNext ? lastPage.result.page + 1 : undefined,
  })

  // Query for all transactions (for summary calculation)
  const { data: allTransactionsData, isLoading: loadingAllTransactions } =
    useQuery({
      queryKey: [
        'allPointTransactions',
        'mine',
        mySlug,
        filters.fromDate,
        filters.toDate,
      ],
      queryFn: async () => {
        try {
          let allTransactions: IPointTransaction[] = []
          let page = 1
          let hasNext = true

          while (hasNext) {
            const params: IMyPointTransactionQuery = {
              page,
              size: 100, // Large page size for faster fetching
              startDate: filters.fromDate,
              endDate: filters.toDate,
            }

            const response = await getMyPointTransactions(params)
            allTransactions = [...allTransactions, ...response.result.items]
            hasNext = response.result.hasNext
            page++
          }
          return allTransactions
        } catch {
          return []
        }
      },
      enabled: enabled && !!mySlug,
    })

  // Flatten paginated transactions
  const transactions = useMemo(() => {
    return transactionsData?.pages.flatMap((page) => page.result.items) || []
  }, [transactionsData])

  // Calculate summary statistics
  const summary = useMemo(() => {
    // Filter allTransactionsData by fromDate and toDate if present
    let filteredTransactions = allTransactionsData || []

    if (filters.fromDate) {
      filteredTransactions = filteredTransactions.filter((txn) =>
        moment(txn.createdAt).isSameOrAfter(
          moment(filters.fromDate).startOf('day'),
        ),
      )
    }
    if (filters.toDate) {
      filteredTransactions = filteredTransactions.filter((txn) =>
        moment(txn.createdAt).isSameOrBefore(
          moment(filters.toDate).endOf('day'),
        ),
      )
    }
    const totalEarned = filteredTransactions
      .filter((txn) => txn.type === PointTransactionType.IN)
      .reduce((sum, txn) => sum + Math.abs(txn.points), 0)

    const totalSpent = filteredTransactions
      .filter((txn) => txn.type === PointTransactionType.OUT)
      .reduce((sum, txn) => sum + Math.abs(txn.points), 0)

    const netDifference = totalEarned - totalSpent

    return {
      totalEarned,
      totalSpent,
      netDifference,
    }
  }, [allTransactionsData, filters.fromDate, filters.toDate])

  // Get total count from first page
  const totalCount = transactionsData?.pages[0]?.result.total || 0

  // Update filters
  const updateFilters = useCallback(
    (newFilters: Partial<UsePointTransactionsFilters>) => {
      setFilters((prev) => ({ ...prev, ...newFilters }))
    },
    [],
  )

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({
      type: PointTransactionType.ALL,
    })
  }, [])

  // Check if filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      !!filters.fromDate ||
      !!filters.toDate ||
      filters.type !== PointTransactionType.ALL
    )
  }, [filters])

  return {
    // Data
    transactions,
    summary,
    totalCount,

    // Loading states
    isLoading,
    loadingAllTransactions,
    isFetchingNextPage,
    isError,

    // Pagination
    hasNextPage,
    fetchNextPage,

    // Filters
    filters,
    updateFilters,
    clearFilters,
    hasActiveFilters,

    // Actions
    refetch,
  }
}

export const useSystemPointTransactions = (params: any) => {
  return useQuery({
    queryKey: ['system-point-transactions', params],
    queryFn: () => getPointTransactions(params),
    placeholderData: keepPreviousData,
  })
}

export const useAnalyzePointTransactions = (params: any, enabled = true) => {
  return useQuery({
    queryKey: ['analyze-point-transactions', params],
    queryFn: () => analyzePointTransactions(params),
    // `enabled`: lượt gọi cho KỲ TRƯỚC chỉ chạy khi người dùng bật so sánh — mặc định
    // true để mọi chỗ gọi sẵn có giữ nguyên hành vi.
    enabled,
  })
}

export const useExportSystemPointTransactions = () => {
  return useMutation({
    mutationFn: async (params: any) => {
      const blob = await exportAllSystemPointTransactions(params)
      const filename = `point-transactions-${new Date().toISOString().split('T')[0]}.xlsx`
      return {
        blob, filename
      }
    },
  })
}
