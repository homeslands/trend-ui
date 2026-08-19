import { useQuery } from '@tanstack/react-query'
import { analyzeBalance, getUserBalance } from '@/api'

export function useGetUserBalance(slug?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['userBalance', slug],
    queryFn: () => getUserBalance(slug),
    enabled,
  })
}

export function useAnalyzeBalance(enabled: boolean = true) {
  return useQuery({
    queryKey: ['analyze-balance'],
    queryFn: () => analyzeBalance(),
    enabled,
  })
}
