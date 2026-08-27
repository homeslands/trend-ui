import { AxiosRequestConfig } from 'axios'
import moment from 'moment'

import { http, httpAuth } from '@/utils'
import { useDownloadStore } from '@/stores'
import {
  IApiResponse,
  IUserInfo,
  IPaginationResponse,
  IUserQuery,
  IUserExportQuery,
  ICreateUserRequest,
  IUpdateUserRequest,
  ICreateUserGroupRequest,
  IUserGroup,
  IUpdateUserGroupRequest,
  IAddUserGroupMemberRequest,
  IAddMultipleUserGroupMemberRequest,
  IUserGroupMember,
  IGetAllUserGroupRequest,
  IGetUserGroupMemberRequest,
  ICreateMembershipCardRequest,
  ICreateMultipleMembershipCardRequest,
  IReplaceMembershipCardRequest,
  ICompleteRegistrationRequest,
  IUserStatisticsQuery,
  IUserStatisticsResponse,
} from '@/types'

export async function getUsers(
  params: IUserQuery | null,
): Promise<IApiResponse<IPaginationResponse<IUserInfo>>> {
  const response = await http.get<IApiResponse<IPaginationResponse<IUserInfo>>>(
    '/user',
    {
      params,
    },
  )
  return response.data
}

export async function getUserBySlug(
  slug: string,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.get<IApiResponse<IUserInfo>>(`/user/${slug}`)
  return response.data
}

// Slug cục bộ của trend khác slug thật bên shared-user — các thao tác chỉ
// tồn tại ở shared-user (reset mật khẩu, khoá/mở khoá tài khoản...) đều
// cần tra lại slug thật theo phonenumber trước khi gọi.
async function findSharedUserSlugByPhonenumber(
  phonenumber: string,
): Promise<string> {
  const listResponse = await httpAuth.get<
    IApiResponse<IPaginationResponse<IUserInfo>>
  >('/user', { params: { phonenumber } })
  const sharedUser = listResponse.data.result.items[0]
  if (!sharedUser) {
    throw new Error('User not found on shared-user')
  }
  return sharedUser.slug
}

// Mật khẩu/tài khoản thuộc shared-user — trend không còn giữ mật khẩu nên
// không thể tự reset — xem progress/trend-api.md giai đoạn 1 (bổ sung).
export async function resetPassword(
  phonenumber: string,
): Promise<IApiResponse<null>> {
  const slug = await findSharedUserSlugByPhonenumber(phonenumber)
  const response = await httpAuth.post<IApiResponse<null>>(
    `/user/${slug}/reset-password`,
  )
  return response.data
}

// Gán role cho user đã tồn tại bên shared-user (tra theo phonenumber) —
// trend tự tạo row cục bộ tối giản nếu đây là lần đầu user này được cấp
// quyền ở trend.
export async function updateUserRole(
  phonenumber: string,
  role: string,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.post<IApiResponse<IUserInfo>>('/user/role', {
    phonenumber,
    role,
  })
  return response.data
}

// Tạo user: gọi trend — trend quyết định role/branch (nghiệp vụ của nó),
// rồi tự gọi nội bộ sang shared-user để lưu identity (mật khẩu, họ tên...).
// UI chỉ gọi đúng 1 API, không tự orchestrate — xem
// progress/trend-api.md giai đoạn 1 (bổ sung).
export async function createUser(
  data: ICreateUserRequest,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.post<IApiResponse<IUserInfo>>('/user', data)
  return response.data
}

export async function updateUser(
  data: IUpdateUserRequest,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.patch<IApiResponse<IUserInfo>>(
    `/user/${data.slug}`,
    data,
  )
  return response.data
}

// Khoá/mở khoá tài khoản quy hẳn về shared-user (không còn route trung
// gian ở trend) — xem progress/trend-api.md giai đoạn 1 (bổ sung).
export async function lockUser(
  phonenumber: string,
): Promise<IApiResponse<null>> {
  const slug = await findSharedUserSlugByPhonenumber(phonenumber)
  const response = await httpAuth.patch<IApiResponse<null>>(
    `/user/${slug}/toggle-active`,
  )
  return response.data
}

export async function createUserGroup(
  data: ICreateUserGroupRequest,
): Promise<IApiResponse<IUserGroup>> {
  const response = await http.post<IApiResponse<IUserGroup>>(
    '/user-group',
    data,
  )
  return response.data
}

export async function getAllUserGroups(
  params: IGetAllUserGroupRequest,
): Promise<IApiResponse<IPaginationResponse<IUserGroup>>> {
  const response = await http.get<
    IApiResponse<IPaginationResponse<IUserGroup>>
  >('/user-group', {
    params,
  })
  return response.data
}

export async function getUserGroupBySlug(
  slug: string,
): Promise<IApiResponse<IUserGroup>> {
  const response = await http.get<IApiResponse<IUserGroup>>(
    `/user-group/${slug}`,
  )
  return response.data
}

export async function updateUserGroup(
  param: IUpdateUserGroupRequest,
): Promise<IApiResponse<IUserGroup>> {
  const response = await http.patch<IApiResponse<IUserGroup>>(
    `/user-group/${param.slug}`,
    param,
  )
  return response.data
}

export async function deleteUserGroup(
  slug: string,
): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(`/user-group/${slug}`)
  return response.data
}

// user group member
export async function addUserGroupMember(
  data: IAddUserGroupMemberRequest,
): Promise<IApiResponse<null>> {
  const response = await http.post<IApiResponse<null>>(
    `/user-group-member`,
    data,
  )
  return response.data
}

export async function addMultipleUserGroupMember(
  data: IAddMultipleUserGroupMemberRequest,
): Promise<IApiResponse<null>> {
  const response = await http.post<IApiResponse<null>>(
    `/user-group-member/bulk`,
    data,
  )
  return response.data
}

export async function getUserGroupMembers(
  params: IGetUserGroupMemberRequest,
): Promise<IApiResponse<IPaginationResponse<IUserGroupMember>>> {
  const response = await http.get<
    IApiResponse<IPaginationResponse<IUserGroupMember>>
  >(`/user-group-member`, {
    params,
  })
  return response.data
}

export async function getUserGroupMemberBySlug(
  slug: string,
): Promise<IApiResponse<IUserGroupMember>> {
  const response = await http.get<IApiResponse<IUserGroupMember>>(
    `/user-group-member/${slug}`,
  )
  return response.data
}

export async function deleteUserGroupMember(
  slug: string,
): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(
    `/user-group-member/${slug}`,
  )
  return response.data
}

// Membership card
export async function createMembershipCard(
  data: ICreateMembershipCardRequest,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.post<IApiResponse<IUserInfo>>(
    '/membership-card',
    data,
  )
  return response.data
}

export async function createMultipleMembershipCard(
  data: ICreateMultipleMembershipCardRequest,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.post<IApiResponse<IUserInfo>>(
    '/membership-card/bulk',
    data,
  )
  return response.data
}

export async function toggleMembershipCard(
  slug: string,
): Promise<IApiResponse<null>> {
  const response = await http.patch<IApiResponse<null>>(
    `/membership-card/user/${slug}/toggle-active`,
  )
  return response.data
}

export async function replaceMembershipCard(
  data: IReplaceMembershipCardRequest,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.patch<IApiResponse<IUserInfo>>(
    '/membership-card/replace',
    data,
  )
  return response.data
}

export async function deleteMembershipCard(
  slug: string,
): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(
    `/membership-card/user/${slug}`,
  )
  return response.data
}

export async function completeRegistration(
  data: ICompleteRegistrationRequest,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.patch<IApiResponse<IUserInfo>>(
    `/user/${data.slug}/complete-registration`,
    data,
  )
  return response.data
}

export async function getUserIdentityCode(): Promise<IApiResponse<{identityCode: string}>> {
  const response = await http.get<IApiResponse<{identityCode: string}>>(
    `/user/identity-code`,
  )
  return response.data
}

export async function exportExcelUsers(
  params: IUserExportQuery,
): Promise<Blob> {
  const { setProgress, setFileName, setIsDownloading, reset } =
    useDownloadStore.getState()

  const currentDate = moment().format('DD-MM-YYYY')
  const fileName = `TRENDCoffee-danh-sach-khach-hang-${currentDate}.xlsx`
  setFileName(fileName)
  setIsDownloading(true)
  try {
    const response = await http.get(`/user/export`, {
      params,
      responseType: 'blob',
      headers: {
        Accept:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      onDownloadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total ?? 1),
        )
        setProgress(percentCompleted)
      },
      doNotShowLoading: true,
    } as AxiosRequestConfig)

    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)

    return response.data
  } finally {
    setIsDownloading(false)
    reset()
  }
}

export async function getUserStatistics(
  params: IUserStatisticsQuery,
): Promise<IApiResponse<IUserStatisticsResponse>> {
  const response = await http.get<IApiResponse<IUserStatisticsResponse>>(
    `/user/statistics`,
    {
      params,
    },
  )
  return response.data
}

/**
 * Chạy tay scheduler gửi lời chúc sinh nhật: gửi lời chúc cho khách có sinh
 * nhật hôm nay theo giờ máy chủ và đã được phát phần thưởng trong năm nay.
 * Không phát phần thưởng — việc đó do lịch tự động lúc 1h sáng đảm nhiệm.
 * Quyền: Admin, SuperAdmin.
 */
export async function triggerBirthdayCampaign(): Promise<IApiResponse<null>> {
  const response = await http.post<IApiResponse<null>>('/user/birthday/trigger')
  return response.data
}
