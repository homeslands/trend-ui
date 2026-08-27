import { useQuery } from '@tanstack/react-query'
import { getAuthScope } from '@/api'
import { QUERYKEY } from '@/constants'
import { useAuthStore } from '@/stores'

/**
 * Hook để lấy danh sách permissions từ API (/auth/scope)
 * @returns Array of permission strings
 */
export function usePermissions(): string[] {
  const { token } = useAuthStore()

  const { data } = useQuery({
    queryKey: [QUERYKEY.authScope],
    queryFn: getAuthScope,
    enabled: !!token,
  })

  return data?.result?.permissions ?? []
}

/**
 * Hook để kiểm tra user có permission cụ thể không
 * @param permission - Permission code cần kiểm tra
 * @returns boolean
 */
export function useHasPermission(permission: string): boolean {
  const permissions = usePermissions()
  return permissions.includes(permission)
}
