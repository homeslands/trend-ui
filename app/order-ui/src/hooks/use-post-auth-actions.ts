import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import {
  useAuthStore,
  useCartItemStore,
  useCurrentUrlStore,
  useUserStore,
} from '@/stores'
import { calculateSmartNavigationUrl, safeNavigate } from '@/utils'
import { ICompleteRegisterResponse } from '@/types'
import { getAuthScope, getProfile } from '@/api'
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

        // Gọi thẳng hàm API chứ không mount useProfile()/usePermissions(): đó là
        // các useQuery không có `enabled`, nên chỉ cần form nào dùng
        // useHandleAuthSuccess là nó bắn request /auth/profile, /auth/scope
        // ngay lúc render — kể cả màn nhập OTP, nơi khách chưa có token, đẻ ra
        // một chuỗi 401 kèm retry.
        // getProfile() giờ gọi trend (không phải shared-user) — trend tự gọi
        // nội bộ sang shared-user ghép identity, nên profile.result đã có
        // sẵn role/branch đúng (nguồn thật), không cần tự ghép ở đây nữa
        // (architect-http.md mục 1.1 quy tắc 4). scope vẫn giữ để lấy
        // permissions cho tính năng điều hướng theo quyền.
        const profile = await getProfile()
        if (!profile?.result) {
          throw new Error('Failed to fetch user profile')
        }
        const scopeResponse = await getAuthScope()
        // Mồi cache để các màn dùng useProfile()/usePermissions() không phải gọi lại.
        queryClient.setQueryData([QUERYKEY.profile], profile)
        queryClient.setQueryData([QUERYKEY.authScope], scopeResponse)

        const userInfo = profile.result
        setUserInfo(userInfo)

        const permissions = scopeResponse?.result?.permissions ?? []

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
