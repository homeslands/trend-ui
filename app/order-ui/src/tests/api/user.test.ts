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

// Mọi hàm trong tệp này gọi **trend** (`http`). `httpAuth` (shared-user) vẫn
// được mock vì `@/utils` export nó, nhưng chỉ còn dùng để khẳng định
// **không ai gọi tới** — xem hai nhóm `resetPassword` / `lockUser`.
//
// Trước 26/10/2026 `resetPassword`/`lockUser` tra slug bên shared-user theo
// SĐT rồi mới thao tác; QĐ16 bỏ bước đó — xem progress/trend-api.md giai đoạn 1.
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

  // Ba ca cũ của nhóm này đo hành vi HAI BƯỚC (tra
  // `GET {shared-user}/user?phonenumber=` lấy slug rồi mới đặt lại mật khẩu
  // ở đó). Hành vi đó **đã bị bỏ có chủ ý** theo QĐ16, xem chú thích trên
  // `resetPassword` trong `api/user.ts`:
  //   - đóng **R1**: quyền quyết định nằm ở trend, gọi thẳng shared-user làm
  //     admin vừa được cấp quyền bị 403 oan;
  //   - đóng **R6**: route kia khớp **chuỗi con** (tra `912345678` ra cả
  //     `0912345678`) nên có thể thao tác nhầm người.
  // Nay hàm nhận `slug` CỤC BỘ của trend, lấy thẳng từ danh sách user mà màn
  // hình đang có, và gọi một lượt duy nhất sang trend.
  describe('resetPassword', () => {
    it('should post to trend with the local slug', async () => {
      const mockResponse = { data: null }
      ;(http.post as Mock).mockResolvedValue(mockResponse)

      const result = await resetPassword('user-1')

      expect(http.post).toHaveBeenCalledWith('/user/user-1/reset-password')
      expect(result).toEqual(mockResponse.data)
    })

    // Canh giữ R1 + R6: không ai được lặng lẽ đưa lại lượt gọi thẳng
    // shared-user hay bước tra ngược theo số điện thoại.
    it('should not touch shared-user at all', async () => {
      ;(http.post as Mock).mockResolvedValue({ data: null })

      await resetPassword('user-1')

      expect(httpAuthMock.get).not.toHaveBeenCalled()
      expect(httpAuthMock.post).not.toHaveBeenCalled()
    })

    it('should handle server error', async () => {
      ;(http.post as Mock).mockRejectedValue(SERVER_ERROR)
      await expect(resetPassword('user-1')).rejects.toEqual(SERVER_ERROR)
    })
  })

  // Cùng lý do với `resetPassword` (QĐ16, một bước theo slug cục bộ). Route
  // `PATCH {trend}/user/:slug/toggle-active` **không** ghi cột `isActive` nào
  // của trend — nó chỉ là cửa kiểm quyền rồi uỷ sang shared-user, nên trạng
  // thái khoá vẫn đúng một nguồn thật.
  describe('lockUser', () => {
    it('should patch trend with the local slug', async () => {
      const mockResponse = { data: null }
      ;(http.patch as Mock).mockResolvedValue(mockResponse)

      const result = await lockUser('user-1')

      expect(http.patch).toHaveBeenCalledWith('/user/user-1/toggle-active')
      expect(result).toEqual(mockResponse.data)
    })

    it('should not touch shared-user at all', async () => {
      ;(http.patch as Mock).mockResolvedValue({ data: null })

      await lockUser('user-1')

      expect(httpAuthMock.get).not.toHaveBeenCalled()
      expect(httpAuthMock.patch).not.toHaveBeenCalled()
    })

    it('should handle server error', async () => {
      ;(http.patch as Mock).mockRejectedValue(SERVER_ERROR)
      await expect(lockUser('user-1')).rejects.toEqual(SERVER_ERROR)
    })
  })

  describe('updateUserRole', () => {
    it('should update user role correctly via local slug', async () => {
      const mockResponse = {
        data: null,
      }
      ;(http.post as Mock).mockResolvedValue(mockResponse)

      const result = await updateUserRole('user-slug', 'admin')
      expect(http.post).toHaveBeenCalledWith('/user/user-slug/role', {
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
        updateUserRole('user-slug', 'invalid-role'),
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
