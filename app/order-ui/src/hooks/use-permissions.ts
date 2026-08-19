import { useMemo } from 'react'
import { jwtDecode } from 'jwt-decode'
import { useAuthStore } from '@/stores'
import { IToken } from '@/types'

/**
 * Hook để lấy danh sách permissions từ JWT token
 * @returns Array of permission strings
 */
export function usePermissions(): string[] {
  const { token } = useAuthStore()

  return useMemo(() => {
    if (!token) return []

    try {
      const decoded: IToken = jwtDecode(token)
      if (!decoded.scope) return []

      const scope = typeof decoded.scope === "string" 
        ? JSON.parse(decoded.scope) 
        : decoded.scope
      
      return scope.permissions || []
    } catch {
      return []
    }
  }, [token])
}

/**
 * Hook để kiểm tra user có permission cụ thể không
 * @param permission - Permission code cần kiểm tra
 * @returns boolean
 */
export function useHasPermission(permission: string): boolean {
  const permissions = usePermissions()
  return useMemo(() => {
    return permissions.includes(permission)
  }, [permissions, permission])
}

