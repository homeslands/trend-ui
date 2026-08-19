import { Role } from '@/constants/role'
import { IPermission } from './permissions.type'
import { IBase } from './base.type'
import { UserRequirementKey, UserRequirementLevel, UserRequirementScope, UserRequirementStatus } from '@/constants/user.constants'

export enum UserStatisticsGroupBy {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year'
}

export interface IUserInfo {
  slug: string
  image?: string
  phonenumber: string
  firstName: string
  lastName: string
  dob: string
  email: string
  address: string
  language: string
  membershipCard?: {
    isActive: boolean
    expiredAt: string
    createdAt: string
    slug: string
  }
  userRequirements: {
    createdAt: string
    slug: string
    key: UserRequirementKey
    status: UserRequirementStatus
    level: UserRequirementLevel
    scope: UserRequirementScope
    expiredAt: string
    lastUpdatedAt: string
  }[]
  branch: {
    addressDetail: {
      lat: number
      lng: number
    }
    slug: string
    name: string
    address: string
  }
  role: {
    name: Role
    slug: string
    createdAt: string
    description: string
    permissions: IPermission[]
  }
  isVerifiedEmail: boolean
  isVerifiedPhonenumber: boolean
  isActive: boolean
}

export interface ICreateUserRequest {
  phonenumber: string
  isVerifiedPhonenumber?: boolean
  password: string
  confirmPassword: string
  firstName?: string
  lastName?: string
  dob?: string | null
  branch?: string
  role: string
}

export interface IUpdateUserRequest {
  slug: string
  // phonenumber: string
  firstName: string
  lastName: string
  dob?: string | null
  // email: string
  address: string
  branch?: string
}

export interface IUserQuery {
  branch?: string
  phonenumber?: string
  membershipCard?: string
  identityCode?: string
  slug?: string // for get user by slug
  page: number | 1
  size: number | 10
  order: 'ASC' | 'DESC'
  hasPaging?: boolean
  role?: string
  startDate?: string
  endDate?: string
  // Lọc theo SINH NHẬT (ngày/tháng, bỏ qua năm) — backend nhận format dd/MM
  birthdayFromDate?: string
  birthdayToDate?: string
}

export interface IUserExportQuery {
  branch?: string
  dobFilterType?: string
  role?: string
  // Lọc theo SINH NHẬT (ngày/tháng, bỏ qua năm) — format dd/MM, giống GET /user
  dobStartDate?: string
  dobEndDate?: string
}

export interface IUpdateProfileRequest {
  firstName: string | null
  lastName: string | null
  dob?: string | null
  address?: string
  branch?: string
}

export interface IUpdatePasswordRequest {
  oldPassword: string
  newPassword: string
}

export interface IUpdateUserRoleRequest {
  slug: string
  role: string
}

export interface ICreateUserGroupRequest {
  name: string
  description?: string
}

export interface ICreateMembershipCardRequest {
  user: string
  code: string
  expiredAt: string
}

export interface ICreateMultipleMembershipCardRequest {
  userGroup: string | null
  codes: string[]
  expiredAt: string
}

export interface IReplaceMembershipCardRequest {
  user: string
  code: string
  expiredAt: string
}

export interface IUserGroup extends IBase {
  name: string
  description?: string
  createdBy: {
    slug: string
    firstName: string
    lastName: string
    phonenumber: string
  }
}

export interface IGetAllUserGroupRequest {
  hasPaging?: boolean
  page?: number | 1
  size?: number | 10
  sort?: string[]
  name?: string
  voucher?: string
  isAppliedVoucher?: boolean
  phonenumber?: string
}

export interface IUpdateUserGroupRequest {
  slug: string
  name: string
  description?: string
}

export interface IAddUserGroupMemberRequest {
  user: string
  userGroup: string
}

export interface IAddMultipleUserGroupMemberRequest {
  users: string[]
  userGroup: string
}

export interface IUserGroupMember extends IBase {
  user: IUserInfo
  userGroup: {
    name: string
    description: string
    createdBy: {
      slug: string
      firstName: string
      lastName: string
      phonenumber: string
    }
    slug: string
    createdAt: string
  }
  createdBy: {
    slug: string
    firstName: string
    lastName: string
    phonenumber: string
  }
}

export interface IGetUserGroupMemberRequest {
  userGroup: string
  page: number | 1
  size: number | 10
  hasPaging?: boolean
  phonenumber?: string
}

export interface ICompleteRegistrationRequest {
  slug: string // user slug
  phonenumber: string
  password: string
}

export interface IDeleteAccountRequest {
  password: string
}

export interface IUserStatisticsQuery {
  startDate: string
  endDate: string
  groupBy: UserStatisticsGroupBy
}

export interface IUserStatisticsItem {
  time: string
  count: number
}

export interface IUserStatisticsResponse {
  data: IUserStatisticsItem[]
  total: number
}
