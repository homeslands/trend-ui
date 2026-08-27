import axios, { AxiosInstance } from 'axios'

import { authURL } from '@/constants'
import { attachAuthInterceptors } from './http'

// Client riêng cho shared-user (identity service): đăng nhập/đăng ký/quên
// mật khẩu/thông tin cá nhân/đổi mật khẩu/xoá tài khoản/avatar. Dùng chung
// interceptor (token, refresh, loading bar) với client trend qua
// attachAuthInterceptors để không đua refresh giữa 2 client — xem
// progress/trend-ui.md giai đoạn 1.
const httpAuth: AxiosInstance = axios.create({
  baseURL: authURL,
  timeout: 10000,
  withCredentials: true,
})

attachAuthInterceptors(httpAuth)

export default httpAuth
