import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { jwtDecode } from 'jwt-decode'

import {
  useAuthStore,
  useCartItemStore,
  useCurrentUrlStore,
  useUserStore,
} from '@/stores'
import { calculateSmartNavigationUrl, safeNavigate } from '@/utils'
import { ICompleteRegisterResponse, IToken } from '@/types'
import { getProfile } from '@/api'
import { QUERYKEY } from '@/constants'

export interface IHandleAuthSuccessOptions {
  /**
   * Nhận quyền điều hướng thay cho hook. Dùng khi nơi gọi cần rẽ nhánh riêng
   * (luồng đăng ký đi tiếp sang màn hồ sơ thay vì về thẳng navigationUrl).
   */
  onSuccess?: (navigationUrl: string) => void
}

/**
 * Xử lý phần việc chung sau khi có token: lưu token, lấy hồ sơ, tính điểm đến.
 * Dùng chung cho đăng nhập và bước hoàn tất đăng ký.
 * Ném lỗi sau khi đã dọn sạch auth state nếu không lấy được hồ sơ.
 */
export const useHandleAuthSuccess = () => {
  const {
    setToken,
    setRefreshToken,
    setExpireTime,
    setExpireTimeRefreshToken,
    setLogout,
  } = useAuthStore()
  const { clearCart } = useCartItemStore()
  const { setUserInfo, removeUserInfo } = useUserStore()
  const { currentUrl, clearUrl } = useCurrentUrlStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useCallback(
    async (
      tokens: ICompleteRegisterResponse,
      options?: IHandleAuthSuccessOptions,
    ) => {
      try {
        clearCart()

        setToken(tokens.accessToken)
        setRefreshToken(tokens.refreshToken)
        setExpireTime(tokens.expireTime)
        setExpireTimeRefreshToken(tokens.expireTimeRefreshToken)

        // Gọi thẳng hàm API chứ không mount useProfile(): hook đó là useQuery
        // không có `enabled`, nên chỉ cần form nào dùng useHandleAuthSuccess là
        // nó bắn request /auth/profile ngay lúc render — kể cả màn nhập OTP,
        // nơi khách chưa có token, đẻ ra một chuỗi 401 kèm retry.
        const profile = await getProfile()
        if (!profile?.result) {
          throw new Error('Failed to fetch user profile')
        }
        // Mồi cache để các màn dùng useProfile() không phải gọi lại.
        queryClient.setQueryData([QUERYKEY.profile], profile)

        const userInfo = profile.result
        setUserInfo(userInfo)

        let permissions: string[] = []
        try {
          const decoded: IToken = jwtDecode(tokens.accessToken)
          if (decoded.scope) {
            const scope =
              typeof decoded.scope === 'string'
                ? JSON.parse(decoded.scope)
                : decoded.scope
            permissions = scope.permissions || []
          }
        } catch {
          permissions = []
        }

        const navigationUrl = calculateSmartNavigationUrl({
          userInfo,
          permissions,
          currentUrl,
        })

        if (options?.onSuccess) {
          // navigationUrl đã được "tiêu thụ" tại đây — dọn currentUrl ngay,
          // trước khi giao quyền điều hướng cho nơi gọi, để lần đăng nhập
          // sau không còn thấy currentUrl cũ (store này persist localStorage).
          clearUrl()
          options.onSuccess(navigationUrl)
          return
        }

        const navigationSuccess = safeNavigate(
          navigate,
          navigationUrl,
          window.location.pathname,
        )
        if (navigationSuccess) {
          clearUrl()
        }
      } catch (error) {
        setLogout()
        removeUserInfo()
        throw error
      }
    },
    [
      clearCart,
      clearUrl,
      currentUrl,
      navigate,
      queryClient,
      removeUserInfo,
      setExpireTime,
      setExpireTimeRefreshToken,
      setLogout,
      setRefreshToken,
      setToken,
      setUserInfo,
    ],
  )
}
