import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { IAuthStore, AuthState } from '@/types'
import moment from 'moment'

export const useAuthStore = create<IAuthStore>()(
  persist(
    (set, get) => ({
      slug: undefined,
      token: undefined,
      refreshToken: undefined,
      expireTime: undefined,
      expireTimeRefreshToken: undefined,
      isRefreshing: false,
      isAuthenticated: () => {
        try {
          const { token, expireTime, refreshToken, expireTimeRefreshToken } =
            get()

          if (!token || !expireTime || !refreshToken || !expireTimeRefreshToken)
            return false

          // ⚠️ Validate data trước khi parse với moment
          if (typeof expireTime !== 'string' || typeof expireTimeRefreshToken !== 'string') {
            // eslint-disable-next-line no-console
            console.error('❌ Invalid token expire time format')
            return false
          }

          const now = moment()
          const tokenExpiresAt = moment(expireTime)
          const refreshExpiresAt = moment(expireTimeRefreshToken)

          // Kiểm tra moment parse có valid không
          if (!tokenExpiresAt.isValid() || !refreshExpiresAt.isValid()) {
            // eslint-disable-next-line no-console
            console.error('❌ Invalid date in token expiration')
            return false
          }

          // Nếu refresh token đã hết hạn thì chắc chắn not authenticated
          if (now.isAfter(refreshExpiresAt)) {
            return false
          }

          // Nếu access token vẫn còn hạn thì OK
          if (now.isBefore(tokenExpiresAt)) {
            return true
          }

          // Nếu access token hết hạn nhưng refresh token còn hạn
          // Chỉ return true nếu không đang trong quá trình refresh
          // Điều này tránh race condition
          return !get().isRefreshing
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('❌ Error checking authentication:', error)
          return false
        }
      },

      isTokenValid: () => {
        try {
          const { token, expireTime, refreshToken, expireTimeRefreshToken } =
            get()

          if (!token || !expireTime || !refreshToken || !expireTimeRefreshToken) {
            return false
          }

          // ⚠️ Validate data type
          if (typeof expireTime !== 'string' || typeof expireTimeRefreshToken !== 'string') {
            return false
          }

          const now = moment()
          const tokenExpiresAt = moment(expireTime)
          const refreshExpiresAt = moment(expireTimeRefreshToken)

          // Validate moment objects
          if (!tokenExpiresAt.isValid() || !refreshExpiresAt.isValid()) {
            return false
          }

          // Nếu refresh token đã hết hạn thì token invalid
          if (now.isAfter(refreshExpiresAt)) {
            return false
          }

          // Nếu access token vẫn còn hạn thì valid
          if (now.isBefore(tokenExpiresAt)) {
            return true
          }

          // Nếu access token hết hạn nhưng refresh token còn hạn thì still valid
          return true
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('❌ Error validating token:', error)
          return false
        }
      },

      needsUserInfo: () => {
        // Basic implementation - để tránh circular dependency
        // Full logic sẽ được implement trong auth-helpers.ts
        return false
      },

      getAuthState: () => {
        const { isRefreshing } = get()

        if (isRefreshing) {
          return AuthState.REFRESHING
        }

        if (!get().isTokenValid()) {
          return AuthState.UNAUTHENTICATED
        }

        // Note: Full userInfo check được implement trong auth-helpers.ts
        // để tránh circular dependency
        return AuthState.AUTHENTICATED
      },
      setSlug: (slug: string) => set({ slug }),
      setToken: (token: string) => set({ token }),
      setRefreshToken: (refreshToken: string) => set({ refreshToken }),
      setExpireTime: (expireTime: string) => set({ expireTime }),
      setExpireTimeRefreshToken: (expireTimeRefreshToken) =>
        set({ expireTimeRefreshToken }),
      setIsRefreshing: (isRefreshing: boolean) => set({ isRefreshing }),
      setLogout: () =>
        set({
          token: undefined,
          expireTime: undefined,
          refreshToken: undefined,
          expireTimeRefreshToken: undefined,
          slug: undefined,
          isRefreshing: false,
        }),
    }),
    {
      name: 'auth-storage',
    },
  ),
)
