import { httpMock, httpAuthMock } from '../__mocks__/httpMock'
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { http } from '@/utils'
import {
  getUsers,
  resetPassword,
  lockUser,
  updateUserRole,
  createUser,
  updateUser,
  triggerBirthdayCampaign,
} from '@/api'
import { SERVER_ERROR } from '../constants'
import { Role } from '@/constants/role'

// resetPassword/createUser gọi shared-user (httpAuth) cho phần identity;
// updateUserRole và phần gán role/branch của createUser gọi trend (http) —
// xem progress/trend-api.md giai đoạn 1 (bổ sung).
vi.mock('@/utils', () => ({
  http: httpMock,
  httpAuth: httpAuthMock,
}))

describe('User API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUsers', () => {
    const queryParams = {
      branch: 'branch-1',
      page: 1,
      size: 10,
      order: 'DESC' as const,
      role: 'admin',
    }

    it('should fetch users correctly with parameters', async () => {
      const mockResponse = {
        data: {
          items: [
            {
              slug: 'user-1',
              firstName: 'John',
              lastName: 'Doe',
              phonenumber: '1234567890',
              branch: {
                slug: 'branch-1',
                name: 'Main Branch',
              },
              role: {
                name: Role.ADMIN,
                slug: 'admin',
              },
            },
          ],
          meta: {
            page: 1,
            total: 1,
          },
        },
      }
      ;(http.get as Mock).mockResolvedValue(mockResponse)

      const result = await getUsers(queryParams)
      expect(http.get).toHaveBeenCalledWith('/user', { params: queryParams })
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle server error', async () => {
      ;(http.get as Mock).mockRejectedValue(SERVER_ERROR)
      await expect(getUsers(null)).rejects.toEqual(SERVER_ERROR)
    })
  })

  describe('resetPassword', () => {
    it('should look up the shared-user slug by phonenumber, then reset there', async () => {
      // Fixture phản ánh đúng response thật: `?phonenumber=` khớp kiểu CHUỖI
      // CON nên trả về cả người có số chứa số đang tra. Chỉ người khớp TUYỆT
      // ĐỐI mới được thao tác — rủi ro R6, xem `api/user.ts`.
      const listResponse = {
        data: {
          result: {
            items: [
              { slug: 'nguoi-khac', phonenumber: '01234567890' },
              { slug: 'shared-user-1', phonenumber: '1234567890' },
            ],
          },
        },
      }
      const resetResponse = { data: null }
      ;(httpAuthMock.get as Mock).mockResolvedValue(listResponse)
      ;(httpAuthMock.post as Mock).mockResolvedValue(resetResponse)

      const result = await resetPassword('1234567890')

      expect(httpAuthMock.get).toHaveBeenCalledWith('/user', {
        params: { phonenumber: '1234567890' },
      })
      expect(httpAuthMock.post).toHaveBeenCalledWith(
        '/user/shared-user-1/reset-password',
      )
      expect(result).toEqual(resetResponse.data)
    })

    it('should throw when no shared-user account matches the phonenumber', async () => {
      ;(httpAuthMock.get as Mock).mockResolvedValue({
        data: { result: { items: [] } },
      })
      await expect(resetPassword('non-existent')).rejects.toThrow(
        'User not found on shared-user',
      )
    })

    it('should handle server error', async () => {
      ;(httpAuthMock.get as Mock).mockRejectedValue(SERVER_ERROR)
      await expect(resetPassword('1234567890')).rejects.toEqual(SERVER_ERROR)
    })

    it('should refuse when no one matches the phonenumber exactly', async () => {
      // Chỉ có người mang số CHỨA số đang tra, không ai khớp tuyệt đối.
      // Bản cũ lấy items[0] nên sẽ đặt lại mật khẩu nhầm người này.
      ;(httpAuthMock.get as Mock).mockResolvedValue({
        data: {
          result: { items: [{ slug: 'nguoi-khac', phonenumber: '01234567890' }] },
        },
      })

      await expect(resetPassword('1234567890')).rejects.toThrow(
        'User not found on shared-user',
      )
      expect(httpAuthMock.post).not.toHaveBeenCalled()
    })
  })

  describe('lockUser', () => {
    it('should look up the shared-user slug by phonenumber, then toggle-active there', async () => {
      // Fixture phản ánh đúng response thật: `?phonenumber=` khớp kiểu CHUỖI
      // CON nên trả về cả người có số chứa số đang tra. Chỉ người khớp TUYỆT
      // ĐỐI mới được thao tác — rủi ro R6, xem `api/user.ts`.
      const listResponse = {
        data: {
          result: {
            items: [
              { slug: 'nguoi-khac', phonenumber: '01234567890' },
              { slug: 'shared-user-1', phonenumber: '1234567890' },
            ],
          },
        },
      }
      const toggleResponse = { data: null }
      ;(httpAuthMock.get as Mock).mockResolvedValue(listResponse)
      ;(httpAuthMock.patch as Mock).mockResolvedValue(toggleResponse)

      const result = await lockUser('1234567890')

      expect(httpAuthMock.get).toHaveBeenCalledWith('/user', {
        params: { phonenumber: '1234567890' },
      })
      expect(httpAuthMock.patch).toHaveBeenCalledWith(
        '/user/shared-user-1/toggle-active',
      )
      expect(result).toEqual(toggleResponse.data)
    })

    it('should throw when no shared-user account matches the phonenumber', async () => {
      ;(httpAuthMock.get as Mock).mockResolvedValue({
        data: { result: { items: [] } },
      })
      await expect(lockUser('non-existent')).rejects.toThrow(
        'User not found on shared-user',
      )
    })

    it('should handle server error', async () => {
      ;(httpAuthMock.get as Mock).mockRejectedValue(SERVER_ERROR)
      await expect(lockUser('1234567890')).rejects.toEqual(SERVER_ERROR)
    })
  })

  describe('updateUserRole', () => {
    it('should update user role correctly via phonenumber', async () => {
      const mockResponse = {
        data: null,
      }
      ;(http.post as Mock).mockResolvedValue(mockResponse)

      const result = await updateUserRole('1234567890', 'admin')
      expect(http.post).toHaveBeenCalledWith('/user/role', {
        phonenumber: '1234567890',
        role: 'admin',
      })
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle invalid role error', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Invalid role' },
        },
      }
      ;(http.post as Mock).mockRejectedValue(mockError)
      await expect(
        updateUserRole('1234567890', 'invalid-role'),
      ).rejects.toEqual(mockError)
    })
  })

  describe('createUser', () => {
    const userData = {
      phonenumber: '1234567890',
      password: 'password123',
      confirmPassword: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      branch: 'branch-1',
      role: 'admin',
    }

    it('should create user correctly (trend orchestrates shared-user internally)', async () => {
      const mockResponse = {
        data: {
          result: {
            slug: 'new-user',
            phonenumber: userData.phonenumber,
            firstName: userData.firstName,
            lastName: userData.lastName,
            branch: { slug: userData.branch },
            role: { slug: userData.role },
          },
        },
      }
      ;(http.post as Mock).mockResolvedValue(mockResponse)

      const result = await createUser(userData)
      expect(http.post).toHaveBeenCalledWith('/user', userData)
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle validation error', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Password mismatch' },
        },
      }
      ;(http.post as Mock).mockRejectedValue(mockError)
      await expect(createUser(userData)).rejects.toEqual(mockError)
    })
  })

  describe('updateUser', () => {
    const updateData = {
      slug: 'user-1',
      firstName: 'John',
      lastName: 'Smith',
      dob: '1990-01-01',
      email: 'john@example.com',
      address: 'New Address',
      branch: 'branch-2',
    }

    it('should update user correctly', async () => {
      const mockResponse = {
        data: {
          ...updateData,
          branch: { slug: updateData.branch },
        },
      }
      ;(http.patch as Mock).mockResolvedValue(mockResponse)

      const result = await updateUser(updateData)
      expect(http.patch).toHaveBeenCalledWith('/user/user-1', updateData)
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle user not found error', async () => {
      const mockError = {
        response: {
          status: 404,
          data: { message: 'User not found' },
        },
      }
      ;(http.patch as Mock).mockRejectedValue(mockError)
      await expect(updateUser(updateData)).rejects.toEqual(mockError)
    })

    it('should handle server error during update', async () => {
      ;(http.patch as Mock).mockRejectedValue(SERVER_ERROR)
      await expect(updateUser(updateData)).rejects.toEqual(SERVER_ERROR)
    })
  })

  describe('triggerBirthdayCampaign', () => {
    it('should post to the birthday trigger endpoint with no body', async () => {
      ;(http.post as Mock).mockResolvedValue({ data: null })

      const result = await triggerBirthdayCampaign()

      expect(http.post).toHaveBeenCalledWith('/user/birthday/trigger')
      expect(result).toBeNull()
    })

    it('should handle server error', async () => {
      ;(http.post as Mock).mockRejectedValue(SERVER_ERROR)
      await expect(triggerBirthdayCampaign()).rejects.toEqual(SERVER_ERROR)
    })
  })
})
