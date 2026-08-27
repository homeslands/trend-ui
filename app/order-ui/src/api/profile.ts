import {
  IApiResponse,
  IUserInfo,
  IUpdateProfileRequest,
  IUpdatePasswordRequest,
  IDeleteAccountRequest,
} from '@/types'
import { http, httpAuth } from '@/utils'

// getProfile gọi trend (không phải shared-user): response cần cả identity
// (shared-user) lẫn role/branch (trend) — trend tự gọi nội bộ sang
// shared-user để ghép trước khi trả về (architect-http.md mục 1.1 quy tắc
// 4). Các hàm còn lại dưới đây (đổi/xem lại không cần role/branch) vẫn gọi
// thẳng shared-user qua httpAuth — xem progress/trend-ui.md giai đoạn 1.
export async function getProfile(): Promise<IApiResponse<IUserInfo>> {
  const response = await http.get<IApiResponse<IUserInfo>>('/auth/profile')
  return response.data
}

export async function updateProfile(
  data: IUpdateProfileRequest,
): Promise<IApiResponse<IUserInfo>> {
  const response = await httpAuth.patch<IApiResponse<IUserInfo>>(
    '/auth/profile',
    data,
  )
  return response.data
}

export async function updatePassword(
  data: IUpdatePasswordRequest,
): Promise<IApiResponse<IUserInfo>> {
  const response = await httpAuth.post<IApiResponse<IUserInfo>>(
    '/auth/change-password',
    data,
  )
  return response.data
}

export async function uploadProfilePicture(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await httpAuth.patch<IApiResponse<IUserInfo>>(
    `/auth/upload`,
    formData,
  )
  return response.data
}

export async function deleteAccount(
  data: IDeleteAccountRequest,
): Promise<IApiResponse<null>> {
  const response = await httpAuth.delete<IApiResponse<null>>('/auth/delete-account', {
    data,
  })
  return response.data
}
